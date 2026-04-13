# cr7 使用手册

cr7 是基于 Claude Code v2.1.88 源码的 CLI 工具，支持 Anthropic Claude、OpenAI、阿里百炼、智谱 AI、DeepSeek、Ollama 等多种模型。

---

## 环境要求

| 依赖                  | 版本     | 说明           |
| --------------------- | -------- | -------------- |
| [Bun](https://bun.sh) | ≥ 1.3.0  | 运行时（必须） |
| Node.js               | ≥ 18.0.0 | 可选，作为备用 |
| macOS / Linux         | —        | Windows 未测试 |

---

## 安装

### 方式一：从源码构建（推荐）

```bash
# 克隆仓库
git clone https://github.com/wanniba/claude-code.git
cd claude-code

# 安装依赖
AUTHORIZED=1 bun install

# 构建
bun run build.ts

# 全局安装（之后用 cr7 命令启动）
npm install -g .
```

### 方式二：直接运行构建产物

```bash
# 构建后直接运行，无需全局安装
./cli.js
```

---

## 启动方式

### 使用 Anthropic Claude（默认）

需要 API Key，从 [console.anthropic.com](https://console.anthropic.com) 获取。

```bash
# 设置 API Key 后启动
ANTHROPIC_API_KEY=sk-ant-xxxx cr7

# 或先导出再启动
export ANTHROPIC_API_KEY=sk-ant-xxxx
cr7
```

### 使用 /model 命令切换模型（推荐）

启动后在对话框中输入 `/model`，通过交互界面选择：

```
/model
```

按 `↑↓` 选择 provider → 选择模型 → 输入 API Key → 回车确认。

配置自动保存到 `~/.claude/settings.json`，下次启动无需重新设置。

---

## 支持的模型 Provider

### 阿里百炼（通义千问）

API Key 从 [百炼控制台](https://bailian.console.aliyun.com/) 获取。

```bash
CLAUDE_CODE_USE_OPENAI=1 \
OPENAI_API_KEY=sk-xxxx \
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
CLAUDE_CODE_MODEL=qwen-max \
cr7
```

可用模型：`qwen-max` / `qwen-plus` / `qwen-turbo` / `qwen-long`

### 智谱 AI（GLM）

API Key 从 [智谱开放平台](https://open.bigmodel.cn) 获取。

```bash
CLAUDE_CODE_USE_OPENAI=1 \
OPENAI_API_KEY=xxxx \
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4 \
CLAUDE_CODE_MODEL=glm-4-air \
cr7
```

可用模型：`glm-4-air` / `glm-4-flash` / `glm-4-plus` / `glm-4-long`

### DeepSeek

API Key 从 [platform.deepseek.com](https://platform.deepseek.com) 获取。

```bash
CLAUDE_CODE_USE_OPENAI=1 \
OPENAI_API_KEY=sk-xxxx \
OPENAI_BASE_URL=https://api.deepseek.com/v1 \
CLAUDE_CODE_MODEL=deepseek-chat \
cr7
```

可用模型：`deepseek-chat` / `deepseek-reasoner`

### OpenAI

```bash
CLAUDE_CODE_USE_OPENAI=1 \
OPENAI_API_KEY=sk-xxxx \
CLAUDE_CODE_MODEL=gpt-4o \
cr7
```

可用模型：`gpt-4o` / `gpt-4o-mini` / `gpt-4-turbo` / `o1` / `o3-mini`

### Ollama（本地模型）

需先安装并运行 [Ollama](https://ollama.com)：

```bash
ollama pull llama3
ollama serve  # 保持后台运行
```

```bash
CLAUDE_CODE_USE_OLLAMA=1 \
CLAUDE_CODE_MODEL=llama3 \
cr7
```

可用模型取决于本地已拉取的模型，用 `ollama list` 查看。

### 自定义 OpenAI 兼容接口（如 LiteLLM）

```bash
CLAUDE_CODE_USE_OPENAI=1 \
OPENAI_API_KEY=any-string \
OPENAI_BASE_URL=http://localhost:4000/v1 \
CLAUDE_CODE_MODEL=gpt-4o \
cr7
```

---

## Shell 别名（快速切换）

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
# Anthropic Claude
alias cr7-claude='ANTHROPIC_API_KEY=sk-ant-xxxx cr7'

# 阿里百炼
alias cr7-qwen='CLAUDE_CODE_USE_OPENAI=1 OPENAI_API_KEY=sk-xxxx OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 CLAUDE_CODE_MODEL=qwen-max cr7'

# 智谱
alias cr7-glm='CLAUDE_CODE_USE_OPENAI=1 OPENAI_API_KEY=xxxx OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4 CLAUDE_CODE_MODEL=glm-4-air cr7'

# DeepSeek
alias cr7-deepseek='CLAUDE_CODE_USE_OPENAI=1 OPENAI_API_KEY=sk-xxxx OPENAI_BASE_URL=https://api.deepseek.com/v1 CLAUDE_CODE_MODEL=deepseek-chat cr7'

# Ollama 本地
alias cr7-local='CLAUDE_CODE_USE_OLLAMA=1 CLAUDE_CODE_MODEL=llama3 cr7'
```

---

## 环境变量一览

| 变量                     | 说明                      | 示例          |
| ------------------------ | ------------------------- | ------------- |
| `ANTHROPIC_API_KEY`      | Anthropic API Key         | `sk-ant-xxxx` |
| `CLAUDE_CODE_USE_OPENAI` | 启用 OpenAI 兼容模式      | `1`           |
| `CLAUDE_CODE_USE_OLLAMA` | 启用 Ollama 本地模式      | `1`           |
| `OPENAI_API_KEY`         | OpenAI 兼容接口的 API Key | `sk-xxxx`     |
| `OPENAI_BASE_URL`        | 自定义 API Base URL       | `https://...` |
| `CLAUDE_CODE_MODEL`      | 指定模型名                | `qwen-max`    |

---

## Provider 对比

| Provider         | 协议        | 需要 API Key | 本地运行 | 工具调用 | 推荐场景           |
| ---------------- | ----------- | ------------ | -------- | -------- | ------------------ |
| Anthropic Claude | Anthropic   | 是           | 否       | ✅ 完整  | 最佳体验           |
| 阿里百炼         | OpenAI 兼容 | 是           | 否       | ✅       | 国内访问、中文优化 |
| 智谱 GLM         | OpenAI 兼容 | 是           | 否       | ✅       | 国内访问、中文优化 |
| DeepSeek         | OpenAI 兼容 | 是           | 否       | ✅       | 低成本、代码能力强 |
| OpenAI           | OpenAI 原生 | 是           | 否       | ✅       | 标准参考           |
| Ollama           | OpenAI 兼容 | 否           | ✅       | 部分     | 离线、隐私优先     |

---

## 常用斜杠命令

| 命令       | 说明                               |
| ---------- | ---------------------------------- |
| `/model`   | 交互式切换模型 provider 和 API Key |
| `/help`    | 查看所有命令                       |
| `/clear`   | 清空当前对话                       |
| `/compact` | 压缩对话历史                       |
| `/cost`    | 查看本次会话费用                   |
| `/config`  | 打开配置界面                       |

---

## 重新构建

源码修改后：

```bash
cd /path/to/claude-code
bun run build.ts
```

构建产物为根目录的 `cli.js`（约 11MB），已排除在 git 之外。
