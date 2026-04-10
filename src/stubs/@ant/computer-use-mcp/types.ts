// Stub for @ant/computer-use-mcp/types (private Anthropic package)
export type CoordinateMode = "pixels" | "normalized";
export type CuSubGates = {
  pixelValidation: boolean;
  clipboardPasteMultiline: boolean;
  mouseAnimation: boolean;
  hideBeforeAction: boolean;
  autoTargetDisplay: boolean;
  clipboardGuard: boolean;
};
export type CuCallToolResult = unknown;
export type CuPermissionRequest = { tool: string; input: unknown };
export type CuPermissionResponse = { granted: boolean };
export type ComputerUseSessionContext = Record<string, unknown>;
export type ScreenshotDims = { width: number; height: number };
export const DEFAULT_GRANT_FLAGS = {};
