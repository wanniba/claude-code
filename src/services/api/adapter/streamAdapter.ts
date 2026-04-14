/**
 * Converts OpenAI streaming chunks → Anthropic BetaRawMessageStreamEvent format
 *
 * This lets claude.ts consume OpenAI streams with zero changes to its
 * existing stream-processing logic.
 *
 * GLM-5.1 and some other models fall back to XML tool calls when given many
 * tool definitions:
 *   <tool_use>
 *     <tool_name>Bash</tool_name>
 *     <input>{"command":"git status"}</input>
 *   </tool_use>
 * We detect and parse these at stream-end and emit proper tool_use events.
 */
import type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// XML tool-call parser
// ---------------------------------------------------------------------------

interface XmlToolCall {
  name: string;
  id: string;
  input: Record<string, unknown>;
}

/**
 * Extract XML-format tool calls from text.
 * Returns null if no <tool_use> blocks are found.
 * Returns {preText, toolCalls} otherwise.
 */
function parseXmlToolCalls(text: string): {
  preText: string;
  toolCalls: XmlToolCall[];
} | null {
  const pattern = /<tool_use>([\s\S]*?)<\/tool_use>/g;
  const firstMatch = pattern.exec(text);
  if (!firstMatch) return null;

  // Collect all matches
  const toolCalls: XmlToolCall[] = [];
  const fullPattern = /<tool_use>([\s\S]*?)<\/tool_use>/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = fullPattern.exec(text)) !== null) {
    const inner = m[1]!;

    // tool_name (fallback: server_name if tool_name absent)
    const nameMatch =
      /<tool_name>([\s\S]*?)<\/tool_name>/.exec(inner) ??
      /<server_name>([\s\S]*?)<\/server_name>/.exec(inner);
    if (!nameMatch) continue;
    const rawName = nameMatch[1]!.trim();

    // Normalise common XML name → cr7 tool name
    const name = normaliseToolName(rawName);

    // input – JSON object or plain text
    const inputMatch = /<input>([\s\S]*?)<\/input>/.exec(inner);
    let input: Record<string, unknown> = {};
    if (inputMatch) {
      const raw = inputMatch[1]!.trim();
      try {
        input = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // Not JSON — wrap in {text:...} so downstream code gets something
        input = { text: raw };
      }
    }

    toolCalls.push({
      name,
      id: `call_${randomUUID().replace(/-/g, "")}`,
      input,
    });
  }

  if (toolCalls.length === 0) return null;

  // Everything before the first <tool_use> is regular text
  const preText = text.slice(0, firstMatch.index).trim();
  return { preText, toolCalls };
}

/** Map XML tool names to cr7 tool names (case-insensitive). */
function normaliseToolName(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === "bash" || lower === "shell") return "Bash";
  if (lower === "read" || lower === "readfile" || lower === "file_read") return "Read";
  if (lower === "write" || lower === "writefile" || lower === "file_write") return "Write";
  if (
    lower === "edit" ||
    lower === "editfile" ||
    lower === "str_replace_editor" ||
    lower === "file_edit"
  )
    return "Edit";
  if (lower === "glob") return "Glob";
  if (lower === "grep") return "Grep";
  return raw; // pass through unknown names unchanged
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

export async function* toAnthropicStream(
  openaiStream: Stream<ChatCompletionChunk>,
  model: string,
): AsyncGenerator<BetaRawMessageStreamEvent> {
  const messageId = `msg_${randomUUID().replace(/-/g, "")}`;

  // Emit message_start
  yield {
    type: "message_start",
    message: {
      id: messageId,
      type: "message",
      role: "assistant",
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  } as BetaRawMessageStreamEvent;

  // Map: openai tool_call index → anthropic content block index
  const toolCallIndexMap = new Map<number, number>();
  let nextBlockIndex = 0;
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  // Buffer text chunks so we can inspect for XML tool calls at stream-end.
  // We do NOT yield text events during streaming — we emit them all at once
  // afterwards (or replace them with tool_use events if XML is detected).
  const textChunks: string[] = [];
  let hasJsonToolCalls = false;

  for await (const chunk of openaiStream) {
    const choice = chunk.choices?.[0];
    if (!choice) continue;

    const delta = choice.delta;

    // Buffer text content (do not yield yet)
    if (delta?.content) {
      textChunks.push(delta.content);
    }

    // JSON tool calls — emit immediately (not XML path)
    if (delta?.tool_calls) {
      hasJsonToolCalls = true;
      for (const tc of delta.tool_calls) {
        const tcIdx = tc.index ?? 0;
        if (!toolCallIndexMap.has(tcIdx)) {
          const blockIndex = nextBlockIndex++;
          toolCallIndexMap.set(tcIdx, blockIndex);
          yield {
            type: "content_block_start",
            index: blockIndex,
            content_block: {
              type: "tool_use",
              id: tc.id ?? `call_${randomUUID().replace(/-/g, "")}`,
              name: tc.function?.name ?? "",
              input: {},
            },
          } as BetaRawMessageStreamEvent;
        }
        if (tc.function?.arguments) {
          yield {
            type: "content_block_delta",
            index: toolCallIndexMap.get(tcIdx)!,
            delta: {
              type: "input_json_delta",
              partial_json: tc.function.arguments,
            },
          } as BetaRawMessageStreamEvent;
        }
      }
    }

    // Stop reason
    if (choice.finish_reason) {
      stopReason = choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn";
    }

    // Usage (often in last chunk)
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? 0;
      outputTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  // --- Post-stream: emit buffered text or XML-parsed tool calls ---
  const fullText = textChunks.join("");

  if (fullText && !hasJsonToolCalls) {
    const parsed = parseXmlToolCalls(fullText);

    if (parsed) {
      // XML tool calls detected — emit preText (if any) then tool_use blocks
      if (parsed.preText) {
        const textIdx = nextBlockIndex++;
        yield {
          type: "content_block_start",
          index: textIdx,
          content_block: { type: "text", text: "" },
        } as BetaRawMessageStreamEvent;
        yield {
          type: "content_block_delta",
          index: textIdx,
          delta: { type: "text_delta", text: parsed.preText },
        } as BetaRawMessageStreamEvent;
        yield {
          type: "content_block_stop",
          index: textIdx,
        } as BetaRawMessageStreamEvent;
      }

      for (const tc of parsed.toolCalls) {
        const blockIndex = nextBlockIndex++;
        yield {
          type: "content_block_start",
          index: blockIndex,
          content_block: {
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: {},
          },
        } as BetaRawMessageStreamEvent;
        yield {
          type: "content_block_delta",
          index: blockIndex,
          delta: {
            type: "input_json_delta",
            partial_json: JSON.stringify(tc.input),
          },
        } as BetaRawMessageStreamEvent;
        yield {
          type: "content_block_stop",
          index: blockIndex,
        } as BetaRawMessageStreamEvent;
      }

      // Override stop_reason to tool_use
      stopReason = "tool_use";
    } else {
      // Plain text response — emit normally
      const textIdx = nextBlockIndex++;
      yield {
        type: "content_block_start",
        index: textIdx,
        content_block: { type: "text", text: "" },
      } as BetaRawMessageStreamEvent;
      yield {
        type: "content_block_delta",
        index: textIdx,
        delta: { type: "text_delta", text: fullText },
      } as BetaRawMessageStreamEvent;
      yield {
        type: "content_block_stop",
        index: textIdx,
      } as BetaRawMessageStreamEvent;
    }
  }

  // Close JSON tool_use blocks (if any)
  for (const blockIndex of toolCallIndexMap.values()) {
    yield {
      type: "content_block_stop",
      index: blockIndex,
    } as BetaRawMessageStreamEvent;
  }

  // message_delta with stop_reason
  yield {
    type: "message_delta",
    delta: {
      stop_reason: stopReason ?? "end_turn",
      stop_sequence: null,
    },
    usage: { output_tokens: outputTokens },
  } as BetaRawMessageStreamEvent;

  // message_stop
  yield {
    type: "message_stop",
  } as BetaRawMessageStreamEvent;
}
