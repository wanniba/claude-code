/**
 * Converts Anthropic tool definitions → OpenAI tool definitions
 */
import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export function toOpenAITools(tools: BetaToolUnion[]): ChatCompletionTool[] {
  const result: ChatCompletionTool[] = [];
  for (const tool of tools) {
    // Only convert function-style tools; skip computer_use / text_editor etc.
    if (tool.type !== "custom" && !("input_schema" in tool)) continue;
    const t = tool as { name: string; description?: string; input_schema: object };
    result.push({
      type: "function",
      function: {
        name: t.name,
        ...(t.description && { description: t.description }),
        parameters: t.input_schema as Record<string, unknown>,
      },
    });
  }
  return result;
}
