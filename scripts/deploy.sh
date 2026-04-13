#!/usr/bin/env bash
# cr7 一键打包部署脚本
# 用法: bash scripts/deploy.sh

set -e

PROJ_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJ_ROOT"

echo "==> [1/3] 安装依赖..."
AUTHORIZED=1 bun install

echo "==> [2/3] 构建 cli.js..."
bun run build.ts

echo "==> [3/3] 全局安装 cr7..."
AUTHORIZED=1 npm install -g .

echo ""
echo "✓ 部署完成！运行 'cr7' 启动。"
echo "  版本：$(cr7 --version 2>/dev/null || echo '见 package.json')"
