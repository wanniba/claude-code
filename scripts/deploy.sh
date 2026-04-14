#!/usr/bin/env bash
# cr7 一键安装脚本
# 用法: bash scripts/deploy.sh

set -e

PROJ_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJ_ROOT"

# ── 1. 安装 Bun（如未安装）──────────────────────────────────────────
if ! command -v bun &>/dev/null; then
  echo "==> [1/5] 安装 Bun..."
  curl -fsSL https://bun.sh/install | bash
  # 让当前 shell 能找到 bun
  export PATH="$HOME/.bun/bin:$PATH"
else
  echo "==> [1/5] Bun 已安装 ($(bun --version))，跳过"
  export PATH="$HOME/.bun/bin:$PATH"
fi

# ── 2. 安装 npm 依赖 ────────────────────────────────────────────────
echo "==> [2/5] 安装依赖..."
AUTHORIZED=1 bun install

# ── 3. 为私有包创建 node_modules stub symlink ───────────────────────
echo "==> [3/5] 注册私有包 stub..."
mkdir -p node_modules/@ant node_modules/@anthropic-ai

link_stub() {
  local pkg="$1" stub="$2"
  if [ ! -e "node_modules/$pkg" ]; then
    ln -sf "$PROJ_ROOT/src/stubs/$stub" "node_modules/$pkg"
  fi
}

link_stub "@ant/claude-for-chrome-mcp"    "@ant/claude-for-chrome-mcp"
link_stub "@ant/computer-use-mcp"         "@ant/computer-use-mcp"
link_stub "@ant/computer-use-swift"       "@ant/computer-use-swift"
link_stub "@anthropic-ai/mcpb"            "@anthropic-ai/mcpb"
link_stub "@anthropic-ai/sandbox-runtime" "@anthropic-ai/sandbox-runtime"

# color-diff-napi: native 包，运行时需要，创建 stub
if [ ! -d "node_modules/color-diff-napi" ]; then
  mkdir -p node_modules/color-diff-napi
  cat > node_modules/color-diff-napi/index.js << 'EOF'
// Stub for color-diff-napi (native package not available on this platform)
export class ColorDiff {}
export class ColorFile {}
export function getSyntaxTheme(_name) { return null; }
EOF
  echo '{"name":"color-diff-napi","version":"0.0.0","type":"module","main":"index.js","exports":{".":"./index.js"}}' \
    > node_modules/color-diff-napi/package.json
fi

# ── 4. 构建 cli.js ──────────────────────────────────────────────────
echo "==> [4/5] 构建 cli.js..."
bun run build.ts

# ── 5. 全局安装 ─────────────────────────────────────────────────────
echo "==> [5/5] 全局安装 cr7..."
AUTHORIZED=1 npm install -g .

echo ""
echo "✓ 安装完成！运行 'cr7' 启动。"
echo "  版本：$(cr7 --version 2>/dev/null || echo '见 package.json')"
echo ""
echo "  首次使用请在对话中输入 /model 配置 API Key。"
