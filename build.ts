#!/usr/bin/env bun
/**
 * Build script for cr7 (claude-code fork)
 *
 * Handles:
 * 1. bun:bundle → stub that returns false for all feature flags
 * 2. Private @ant/* and @anthropic-ai/mcpb packages → local stubs
 * 3. Path alias `src/` → ./src/
 */

import { resolve } from "path";
import { execa } from "execa";

const ROOT = import.meta.dir;
const STUBS = resolve(ROOT, "src/stubs");

console.log("Building cr7...");

const result = await Bun.build({
  entrypoints: [resolve(ROOT, "src/main.tsx")],
  outdir: ROOT,
  naming: "cli.js",
  target: "bun",
  format: "esm",
  minify: false,
  sourcemap: "none",
  alias: {
    // bun:bundle stub — feature() always returns false
    "bun:bundle": resolve(STUBS, "bun-bundle.ts"),
    // Private package stubs
    "@ant/computer-use-mcp": resolve(STUBS, "@ant/computer-use-mcp/index.ts"),
    "@ant/computer-use-mcp/types": resolve(STUBS, "@ant/computer-use-mcp/types.ts"),
    "@ant/computer-use-mcp/sentinelApps": resolve(STUBS, "@ant/computer-use-mcp/sentinelApps.ts"),
    "@ant/claude-for-chrome-mcp": resolve(STUBS, "@ant/claude-for-chrome-mcp/index.ts"),
    "@ant/computer-use-swift": resolve(STUBS, "@ant/computer-use-swift/index.ts"),
    "@anthropic-ai/mcpb": resolve(STUBS, "@anthropic-ai/mcpb/index.ts"),
    // Path alias used throughout source
    src: resolve(ROOT, "src"),
  },
  external: [
    "@anthropic-ai/sdk",
    "@anthropic-ai/claude-agent-sdk",
    "@modelcontextprotocol/sdk",
    "@aws-sdk/client-bedrock-runtime",
    "@commander-js/extra-typings",
    "@growthbook/growthbook",
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/core",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-trace-base",
    "@img/sharp-darwin-arm64",
    "@img/sharp-darwin-x64",
    "ajv",
    "asciichart",
    "auto-bind",
    "axios",
    "bidi-js",
    "chalk",
    "chokidar",
    "cli-boxes",
    "code-excerpt",
    "diff",
    "emoji-regex",
    "env-paths",
    "execa",
    "figures",
    "fuse.js",
    "get-east-asian-width",
    "google-auth-library",
    "highlight.js",
    "https-proxy-agent",
    "ignore",
    "indent-string",
    "lodash-es",
    "lru-cache",
    "marked",
    "openai",
    "p-map",
    "picomatch",
    "proper-lockfile",
    "qrcode",
    "react",
    "react-reconciler",
    "semver",
    "shell-quote",
    "signal-exit",
    "stack-utils",
    "strip-ansi",
    "supports-hyperlinks",
    "tree-kill",
    "type-fest",
    "undici",
    "usehooks-ts",
    "vscode-languageserver-protocol",
    "wrap-ansi",
    "ws",
    "xss",
    "zod",
    // Additional npm packages
    "fflate",
    "jsonc-parser",
    "yaml",
    "@alcalzone/ansi-tokenize",
    "@aws-sdk/client-bedrock",
    "@aws-sdk/client-sts",
    "@azure/identity",
    "@anthropic-ai/bedrock-sdk",
    "@anthropic-ai/vertex-sdk",
    "@anthropic-ai/foundry-sdk",
    // Private/native packages — never loaded (all feature flags = false)
    "@anthropic-ai/sandbox-runtime",
    "color-diff-napi",
    "modifiers-napi",
    "sharp",
    // OpenTelemetry exporters (optional)
    "@opentelemetry/exporter-logs-otlp-grpc",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/exporter-logs-otlp-proto",
    "@opentelemetry/exporter-metrics-otlp-grpc",
    "@opentelemetry/exporter-metrics-otlp-http",
    "@opentelemetry/exporter-metrics-otlp-proto",
    "@opentelemetry/exporter-prometheus",
    "@opentelemetry/exporter-trace-otlp-grpc",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-trace-otlp-proto",
    "turndown",
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}

// Add shebang to output
const outFile = resolve(ROOT, "cli.js");
const content = await Bun.file(outFile).text();
if (!content.startsWith("#!")) {
  await Bun.write(outFile, `#!/usr/bin/env bun\n${content}`);
}

await execa("chmod", ["+x", outFile]);
console.log("✓ Built cli.js");
