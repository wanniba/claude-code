/**
 * Converts Anthropic message format → OpenAI chat completion format
 */
import type {
  BetaMessageParam,
  BetaContentBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

function contentBlockToOpenAI(block: BetaContentBlockParam): ChatCompletionContentPart | null {
  if (typeof block === "string") {
    return { type: "text", text: block };
  }
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "image": {
      const src = block.source;
      if (src.type === "base64") {
        return {
          type: "image_url",
          image_url: { url: `data:${src.media_type};base64,${src.data}` },
        };
      }
      if (src.type === "url") {
        return { type: "image_url", image_url: { url: src.url } };
      }
      return null;
    }
    // thinking blocks have no OpenAI equivalent — skip
    case "thinking":
    case "redacted_thinking":
      return null;
    default:
      return null;
  }
}

export function toOpenAIMessages(
  messages: BetaMessageParam[],
  system?: string,
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (msg.role === "user") {
      const content = msg.content;
      if (typeof content === "string") {
        result.push({ role: "user", content });
        continue;
      }

      // Separate tool_result blocks from regular content
      const toolResults: Array<{ tool_use_id: string; content: string }> = [];
      const textParts: ChatCompletionContentPart[] = [];

      for (const block of content) {
        if (typeof block !== "string" && block.type === "tool_result") {
          const toolContent =
            typeof block.content === "string"
              ? block.content
              : Array.isArray(block.content)
                ? block.content
                    .filter(
                      (b): b is { type: "text"; text: string } =>
                        typeof b !== "string" && b.type === "text",
                    )
                    .map((b) => b.text)
                    .join("\n")
                : "";
          toolResults.push({
            tool_use_id: block.tool_use_id,
            content: toolContent,
          });
        } else {
          const converted = contentBlockToOpenAI(block as BetaContentBlockParam);
          if (converted) textParts.push(converted);
        }
      }

      // Emit tool result messages first
      for (const tr of toolResults) {
        result.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        });
      }

      // Then regular user content
      if (textParts.length > 0) {
        result.push({
          role: "user",
          content:
            textParts.length === 1 && textParts[0].type === "text" ? textParts[0].text : textParts,
        });
      }
    } else if (msg.role === "assistant") {
      const content = msg.content;
      if (typeof content === "string") {
        result.push({ role: "assistant", content });
        continue;
      }

      const textParts: string[] = [];
      const toolCalls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }> = [];

      for (const block of content) {
        if (typeof block === "string") {
          textParts.push(block);
        } else if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
        // skip thinking blocks
      }

      const assistantMsg: ChatCompletionMessageParam = {
        role: "assistant",
        content: textParts.join("") || null,
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      };
      result.push(assistantMsg);
    }
  }

  return result;
}
