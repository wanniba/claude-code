// Stub for @ant/computer-use-mcp (private Anthropic package)
export const buildComputerUseTools = (_config?: unknown) => [];
export const createComputerUseMcpServer = (_config?: unknown) => null;
export const bindSessionContext = (_ctx?: unknown) => {};
export const DEFAULT_GRANT_FLAGS = {};
export const API_RESIZE_PARAMS = { width: 1280, height: 800 };
export const targetImageSize = (_dims?: unknown) => ({ width: 1280, height: 800 });

export type ComputerUseSessionContext = Record<string, unknown>;
export type CuCallToolResult = unknown;
export type CuPermissionRequest = { tool: string; input: unknown };
export type CuPermissionResponse = { granted: boolean };
export type ScreenshotDims = { width: number; height: number };
