// Stub for bun:bundle — replaces Bun's compile-time feature flag API.
// All flags return false (features disabled) in open-source builds.
export function feature(_flag: string): boolean {
  return false;
}
