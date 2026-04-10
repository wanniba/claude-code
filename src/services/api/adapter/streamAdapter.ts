/**
 * Converts OpenAI streaming chunks → Anthropic BetaRawMessageStreamEvent format
 *
 * This lets claude.ts consume OpenAI streams with zero changes to its
 * existing stream-processing logic.
 */
import type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { randomUUID } from "crypto";

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

  let textBlockOpen = false;
  let textBlockIndex = 0;
  // Map: openai tool_call index → anthropic content block index
  const toolCallIndexMap = new Map<number, number>();
  let nextBlockIndex = 0;
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const chunk of openaiStream) {
    const choice = chunk.choices?.[0];
    if (!choice) continue;

    const delta = choice.delta;

    // Text content
    if (delta?.content) {
      if (!textBlockOpen) {
        textBlockOpen = true;
        textBlockIndex = nextBlockIndex++;
        yield {
          type: "content_block_start",
          index: textBlockIndex,
          content_block: { type: "text", text: "" },
        } as BetaRawMessageStreamEvent;
      }
      yield {
        type: "content_block_delta",
        index: textBlockIndex,
        delta: { type: "text_delta", text: delta.content },
      } as BetaRawMessageStreamEvent;
    }

    // Tool calls
    if (delta?.tool_calls) {
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

  // Close open text block
  if (textBlockOpen) {
    yield {
      type: "content_block_stop",
      index: textBlockIndex,
    } as BetaRawMessageStreamEvent;
  }

  // Close tool_use blocks
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
