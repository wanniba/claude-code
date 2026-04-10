// Stub for @ant/claude-for-chrome-mcp (private Anthropic package)
export const BROWSER_TOOLS: unknown[] = [];
export const createClaudeForChromeMcpServer = (_config?: unknown) => null;

export type ClaudeForChromeContext = Record<string, unknown>;
export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};
export type PermissionMode = "auto" | "manual";
