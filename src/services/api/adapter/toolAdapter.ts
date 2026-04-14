/**
 * Converts Anthropic tool definitions → OpenAI tool definitions
 */
import type { BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Simplify a JSON Schema for OpenAI-compat models that struggle with complex
 * schemas. Keeps only required properties and strips nested complexity.
 */
function simplifySchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type !== "object" || !schema.properties) {
    return schema;
  }

  const required = (schema.required as string[] | undefined) ?? [];
  const props = schema.properties as Record<string, unknown>;

  // Keep only required properties, or all if none are marked required
  const keysToKeep = required.length > 0 ? required : Object.keys(props);
  const simplified: Record<string, unknown> = {};
  for (const key of keysToKeep) {
    const prop = props[key] as Record<string, unknown> | undefined;
    if (!prop) continue;
    // Flatten to just type + description, no nested schemas
    simplified[key] = {
      type: prop.type ?? "string",
      ...(prop.description ? { description: prop.description } : {}),
    };
  }

  return {
    type: "object",
    properties: simplified,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function toOpenAITools(tools: BetaToolUnion[], simplified = false): ChatCompletionTool[] {
  const result: ChatCompletionTool[] = [];
  for (const tool of tools) {
    // Only convert function-style tools; skip computer_use / text_editor etc.
    if (tool.type !== "custom" && !("input_schema" in tool)) continue;
    const t = tool as { name: string; description?: string; input_schema: object };
    const schema = t.input_schema as Record<string, unknown>;
    result.push({
      type: "function",
      function: {
        name: t.name,
        // simplified=true: keep only the first sentence of the description.
        // Full descriptions cost 200-500 tokens per tool; with 40+ tools that's
        // 8000-20000 tokens of tool docs crowding out context. A one-liner is
        // enough for the model to know when to use each tool.
        ...(t.description && {
          description: simplified
            ? t.description
                .split(/[.。\n]/)[0]!
                .trim()
                .slice(0, 80)
            : t.description,
        }),
        parameters: simplified ? simplifySchema(schema) : schema,
      },
    });
  }
  return result;
}
