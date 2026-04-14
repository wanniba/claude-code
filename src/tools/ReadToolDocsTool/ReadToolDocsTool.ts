/**
 * ReadToolDocs — lazy tool documentation loader for OpenAI-compat providers.
 *
 * Problem: cr7 passes 40+ tools to GLM/Qwen. If every tool ships its full
 * description (~200 tokens each), the tool-doc overhead alone is 8000+ tokens,
 * crowding out context and causing the model to ignore tool-calling instructions.
 *
 * Solution (inspired by cr7 skills):
 * - All tools are listed with a one-sentence description (minimal upfront cost).
 * - Before calling any tool, the model calls ReadToolDocs("ToolName") to fetch
 *   the full documentation for that specific tool.
 * - cr7 executes ReadToolDocs (no API call needed — it's purely local) and
 *   returns the full description as a tool result.
 * - The model then calls the real tool with full context.
 *
 * This tool is only enabled for OpenAI-compat providers (GLM, Qwen, DeepSeek…);
 * Anthropic Claude reads tool descriptions natively and doesn't need this.
 */
import { z } from "zod/v4";
import { buildTool, type ToolDef, type ToolUseContext } from "../../Tool.js";
import { getAPIProvider } from "../../utils/model/providers.js";
import { lazySchema } from "../../utils/lazySchema.js";
import { zodToJsonSchema } from "../../utils/zodToJsonSchema.js";

export const READ_TOOL_DOCS_TOOL_NAME = "ReadToolDocs";

const inputSchema = lazySchema(() =>
  z.strictObject({
    tool_name: z
      .string()
      .describe("The exact name of the tool whose documentation you want to read"),
  }),
);
type InputSchema = ReturnType<typeof inputSchema>;

export const ReadToolDocsTool = buildTool({
  name: READ_TOOL_DOCS_TOOL_NAME,
  searchHint: "read full documentation for a tool before using it",
  maxResultSizeChars: 50_000,

  async description() {
    return "Read the full documentation for a tool before using it. Call this first whenever you are about to use a tool and need to understand its complete parameters and behavior.";
  },

  async prompt() {
    return (
      "Reads the complete documentation (description + parameter schema) for a named tool.\n" +
      "Use this before calling any tool you are not certain about.\n\n" +
      'Input: { "tool_name": "<exact tool name>" }\n' +
      "Output: Full tool description and parameter schema as text."
    );
  },

  get inputSchema(): InputSchema {
    return inputSchema();
  },

  isEnabled() {
    // Only expose this tool to OpenAI-compat providers; Claude doesn't need it.
    const p = getAPIProvider();
    return p === "openai" || p === "ollama";
  },

  isConcurrencySafe() {
    return true;
  },
  isReadOnly() {
    return true;
  },

  renderToolUseMessage(input) {
    return `ReadToolDocs("${(input as { tool_name?: string }).tool_name ?? "?"}")`;
  },

  toAutoClassifierInput() {
    return "";
  },

  async call({ tool_name }: { tool_name: string }, context: ToolUseContext) {
    const allTools = context.options.tools ?? [];
    const target = allTools.find((t) => t.name === tool_name);

    if (!target) {
      const names = allTools
        .filter((t) => t.name !== READ_TOOL_DOCS_TOOL_NAME)
        .map((t) => t.name)
        .join(", ");
      return {
        data: {
          error: `Tool "${tool_name}" not found.`,
          available_tools: names,
        },
      };
    }

    // Fetch full description via the tool's own prompt() method
    const description = await target.prompt({
      getToolPermissionContext: context.options.getToolPermissionContext,
      tools: context.options.tools,
      agents: context.options.agents ?? [],
      allowedAgentTypes: context.options.allowedAgentTypes,
    });

    // Also include the JSON schema so the model knows exact parameter names
    const schema = JSON.stringify(zodToJsonSchema(target.inputSchema), null, 2);

    return {
      data: {
        tool_name,
        documentation: description,
        parameter_schema: schema,
      },
    };
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const d = content as {
      error?: string;
      available_tools?: string;
      tool_name?: string;
      documentation?: string;
      parameter_schema?: string;
    };

    let text: string;
    if (d.error) {
      text = `Error: ${d.error}\nAvailable tools: ${d.available_tools ?? ""}`;
    } else {
      text =
        `# ${d.tool_name}\n\n` +
        `## Description\n${d.documentation ?? ""}\n\n` +
        `## Parameter Schema\n\`\`\`json\n${d.parameter_schema ?? ""}\n\`\`\``;
    }

    return {
      tool_use_id: toolUseID,
      type: "tool_result" as const,
      content: text,
    };
  },
} satisfies ToolDef<InputSchema>);
