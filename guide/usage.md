# cr7 使用手册

cr7 是基于 Claude Code v2.1.88 源码改造的 CLI 工具，**不依赖 Anthropic 账户**，支持阿里百炼、智谱 AI、DeepSeek、OpenAI、Ollama 等模型。

---

## 环境要求

| 依赖                  | 版本    | 说明           |
| --------------------- | ------- | -------------- |
| [Bun](https://bun.sh) | ≥ 1.3.0 | 运行时（必须） |
| macOS / Linux         | —       | Windows 未测试 |

---

## 安装

### 从源码构建

```bash
git clone https://github.com/wanniba/claude-code.git
cd claude-code

# 安装依赖
AUTHORIZED=1 bun install

# 构建
bun run build.ts

# 全局安装（之后用 cr7 命令启动）
npm install -g .
```

### 直接运行构建产物

```bash
./cli.js
```

---

## 启动

首次启动后，在对话框中输入 `/model` 选择 provider 和配置 API Key：

```bash
cr7
# 进入后输入：
/model
```

按 `↑↓` 选择 provider → 选择模型 → 输入 API Key → 回车确认。

配置保存到 `~/.claude/settings.json`，下次启动无需重新设置。

---

## 支持的模型

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

可用模型：`glm-5.1`（推荐）/ `glm-4-air` / `glm-4-flash` / `glm-4-plus` / `glm-4-long`

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

### Ollama（本地模型，无需 API Key）

先安装并运行 [Ollama](https://ollama.com)：

```bash
ollama pull llama3
ollama serve
```

```bash
CLAUDE_CODE_USE_OLLAMA=1 CLAUDE_CODE_MODEL=llama3 cr7
```

### 自定义 OpenAI 兼容接口

```bash
CLAUDE_CODE_USE_OPENAI=1 \
OPENAI_API_KEY=any-string \
OPENAI_BASE_URL=http://localhost:4000/v1 \
CLAUDE_CODE_MODEL=gpt-4o \
cr7
```

---

## Shell 别名（快速切换）

在 `~/.zshrc` 中添加：

```bash
alias cr7-qwen='CLAUDE_CODE_USE_OPENAI=1 OPENAI_API_KEY=sk-xxxx OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 CLAUDE_CODE_MODEL=qwen-max cr7'
alias cr7-glm='CLAUDE_CODE_USE_OPENAI=1 OPENAI_API_KEY=xxxx OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4 CLAUDE_CODE_MODEL=glm-4-air cr7'
alias cr7-deepseek='CLAUDE_CODE_USE_OPENAI=1 OPENAI_API_KEY=sk-xxxx OPENAI_BASE_URL=https://api.deepseek.com/v1 CLAUDE_CODE_MODEL=deepseek-chat cr7'
alias cr7-local='CLAUDE_CODE_USE_OLLAMA=1 CLAUDE_CODE_MODEL=llama3 cr7'
```

---

## 环境变量

| 变量                     | 说明                 | 示例          |
| ------------------------ | -------------------- | ------------- |
| `CLAUDE_CODE_USE_OPENAI` | 启用 OpenAI 兼容模式 | `1`           |
| `CLAUDE_CODE_USE_OLLAMA` | 启用 Ollama 本地模式 | `1`           |
| `OPENAI_API_KEY`         | API Key              | `sk-xxxx`     |
| `OPENAI_BASE_URL`        | 自定义 Base URL      | `https://...` |
| `CLAUDE_CODE_MODEL`      | 模型名               | `qwen-max`    |

---

## Provider 对比

| Provider | 需要 API Key | 本地运行 | 工具调用 | 推荐场景           |
| -------- | ------------ | -------- | -------- | ------------------ |
| 阿里百炼 | 是           | 否       | ✅       | 国内访问、中文优化 |
| 智谱 GLM | 是           | 否       | ✅       | 国内访问、中文优化 |
| DeepSeek | 是           | 否       | ✅       | 低成本、代码能力强 |
| OpenAI   | 是           | 否       | ✅       | 标准参考           |
| Ollama   | 否           | ✅       | 部分     | 离线、隐私优先     |
| 自定义   | 视情况       | 视情况   | 视情况   | LiteLLM 等代理     |

---

## 常用斜杠命令

| 命令       | 说明                               |
| ---------- | ---------------------------------- |
| `/model`   | 交互式切换模型 provider 和 API Key |
| `/help`    | 查看所有命令                       |
| `/clear`   | 清空当前对话                       |
| `/compact` | 压缩对话历史                       |
| `/cost`    | 查看本次会话费用                   |

---

## 重新构建

```bash
bun run build.ts
```
