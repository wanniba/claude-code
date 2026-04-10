// Stub for @anthropic-ai/mcpb (private Anthropic package for .mcpb/.dxt plugin format)
export type McpbManifest = {
  name: string;
  version: string;
  author: { name: string };
  server?: unknown;
  user_config?: Record<string, McpbUserConfigurationOption>;
};

export type McpbUserConfigurationOption = {
  type: "string" | "number" | "boolean" | "file" | "directory";
  title?: string;
  description?: string;
  required?: boolean;
  sensitive?: boolean;
  multiple?: boolean;
  min?: number;
  max?: number;
};

export const getMcpConfigForManifest = async (_options: {
  manifest: McpbManifest;
  extensionPath: string;
  systemDirs: unknown;
  userConfig?: unknown;
  pathSeparator?: string;
}) => null;
