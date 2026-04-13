// Stub for @anthropic-ai/sandbox-runtime (private Anthropic package)
import { z } from "zod";

export type FsReadRestrictionConfig = unknown;
export type FsWriteRestrictionConfig = unknown;
export type IgnoreViolationsConfig = unknown;
export type NetworkHostPattern = unknown;
export type NetworkRestrictionConfig = unknown;
export type SandboxAskCallback = unknown;
export type SandboxDependencyCheck = unknown;
export type SandboxRuntimeConfig = Record<string, unknown>;
export type SandboxViolationEvent = unknown;

export const SandboxRuntimeConfigSchema = z.object({}).passthrough();

export class SandboxManager {
  constructor(_config?: unknown) {}
  async start() {}
  async stop() {}
  isEnabled() {
    return false;
  }
}

export class SandboxViolationStore {
  getViolations() {
    return [];
  }
  clear() {}
}
