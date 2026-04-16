// Stub for bun:bundle — replaces Bun's compile-time feature flag API.
// Default: features disabled. The set below selectively re-enables flags whose
// implementation is fully self-contained in cr7's source (no Anthropic-side
// dependencies). See doc/cr7-unlock.md for the audit and rationale.
const ENABLED_FEATURES = new Set<string>([
  // Cron-driven self-triggering: ScheduleCronTool + utils/cronScheduler all
  // present locally; persists jobs to .claude/scheduled_tasks.json.
  "AGENT_TRIGGERS",
  // Multi-agent orchestration: coordinator/coordinatorMode.ts present;
  // also requires CLAUDE_CODE_COORDINATOR_MODE=1 at runtime to engage.
  "COORDINATOR_MODE",
]);

export function feature(flag: string): boolean {
  return ENABLED_FEATURES.has(flag);
}
