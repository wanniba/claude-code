# 多模型支持设计方案

## 目标

在不破坏现有 Anthropic 功能的前提下，让 Claude Code 支持 OpenAI 兼容模型（GPT-4o、DeepSeek、Ollama 等）。

## 现状分析

### 调用链

```
query.ts
  → services/api/claude.ts        # 组装请求参数，处理流式响应
    → services/api/client.ts      # 创建 Anthropic SDK 实例
      → @anthropic-ai/sdk         # 实际 HTTP 请求
```

### 问题所在

消息格式类型从 `@anthropic-ai/sdk` 渗透到整个 codebase：

- `claude.ts` 里组装的是 `BetaMessageStreamParams`（Anthropic 格式）
- 流式响应处理的是 `BetaRawMessageStreamEvent`（Anthropic 格式）
- 工具定义用的是 `BetaToolUnion`（Anthropic 格式）

**直接全部替换**的成本极高，且会破坏 Anthropic 独有功能（thinking、prompt caching、effort 等）。

---

## 设计方案：适配器层（Adapter Layer）

### 核心思路

**不动内部逻辑**，在 `claude.ts` 发出请求 / 收到响应的边界处加一个双向适配器：

```
内部（Anthropic 格式）  ←→  [Adapter]  ←→  外部（OpenAI / 其他格式）
```

### 架构图

```
query.ts
  └── services/api/claude.ts
        │  组装 Anthropic 格式请求
        │
        ▼
  [NEW] services/api/adapter/
        │  ┌─ toProviderRequest()   Anthropic → 目标格式
        │  └─ toAnthropicStream()   目标响应 → Anthropic 格式流
        │
        ▼
  services/api/client.ts
        │  getAnthropicClient()   (现有)
        │  getOpenAIClient()      (新增)
        ▼
  @anthropic-ai/sdk  /  openai SDK  /  fetch(Ollama)
```

---

## 文件改动清单

### 1. `src/utils/model/providers.ts` — 新增 Provider 类型

```ts
// 现有
export type APIProvider = "firstParty" | "bedrock" | "vertex" | "foundry";

// 改为
export type APIProvider = "firstParty" | "bedrock" | "vertex" | "foundry" | "openai" | "ollama";

export function getAPIProvider(): APIProvider {
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_OPENAI)) return "openai";
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_OLLAMA)) return "ollama";
  // ... 现有逻辑不变
}
```

**环境变量**：

| 变量                       | 说明                                                    |
| -------------------------- | ------------------------------------------------------- |
| `CLAUDE_CODE_USE_OPENAI=1` | 启用 OpenAI 兼容模式                                    |
| `OPENAI_API_KEY`           | OpenAI / 兼容服务的 API Key                             |
| `OPENAI_BASE_URL`          | 可选，自定义 base URL（用于 DeepSeek、本地 LiteLLM 等） |
| `CLAUDE_CODE_USE_OLLAMA=1` | 启用 Ollama 本地模式                                    |
| `OLLAMA_BASE_URL`          | 默认 `http://localhost:11434`                           |
| `CLAUDE_CODE_MODEL`        | 指定模型名，如 `gpt-4o`、`deepseek-chat`                |

---

### 2. `src/services/api/client.ts` — 新增客户端创建

新增 `getOpenAIClient()` 函数，返回符合 OpenAI SDK 接口的客户端。
现有 `getAnthropicClient()` 完全不动。

---

### 3. `src/services/api/adapter/` — 新建适配器目录（核心）

#### `messageAdapter.ts` — 消息格式转换

```
Anthropic MessageParam  →  OpenAI ChatCompletionMessageParam
```

主要转换规则：

| Anthropic                                       | OpenAI                                               |
| ----------------------------------------------- | ---------------------------------------------------- |
| `role: user, content: [{type:'text'}]`          | `role: user, content: string`                        |
| `role: user, content: [{type:'tool_result'}]`   | `role: tool, content: string`                        |
| `role: assistant, content: [{type:'tool_use'}]` | `role: assistant, tool_calls: [...]`                 |
| `system` 参数                                   | `{role: 'system', content: ...}` 插入消息首位        |
| `content: [{type:'image'}]`                     | `content: [{type:'image_url', image_url:{url:...}}]` |
| `thinking` block                                | **忽略**（OpenAI 不支持）                            |

#### `toolAdapter.ts` — 工具格式转换

```
BetaToolUnion  →  OpenAI ChatCompletionTool
```

Anthropic 工具格式和 OpenAI 高度相似，主要差异：

| Anthropic                           | OpenAI                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `{name, description, input_schema}` | `{type:'function', function:{name, description, parameters}}` |
| `cache_control`                     | **忽略**                                                      |

#### `streamAdapter.ts` — 流式响应转换

把 OpenAI 的 `ChatCompletionChunk` 流转换为 Anthropic 的 `BetaRawMessageStreamEvent` 格式，
让 `claude.ts` 里现有的流处理逻辑完全不用改。

关键事件映射：

| OpenAI chunk                             | Anthropic event                           |
| ---------------------------------------- | ----------------------------------------- |
| `choices[0].delta.content`               | `content_block_delta` (text)              |
| `choices[0].delta.tool_calls`            | `content_block_delta` (input_json_delta)  |
| `choices[0].finish_reason: 'stop'`       | `message_delta` (stop_reason: 'end_turn') |
| `choices[0].finish_reason: 'tool_calls'` | `message_delta` (stop_reason: 'tool_use') |
| `usage`                                  | `message_delta` (usage)                   |

---

### 4. `src/services/api/claude.ts` — 最小化改动

只在 **发出请求前** 和 **收到响应后** 插入适配器调用：

```ts
// 伪代码，改动在两处
const provider = getAPIProvider();

if (provider === "openai" || provider === "ollama") {
  const openaiRequest = toOpenAIRequest(anthropicRequest);
  const openaiStream = await openaiClient.chat.completions.stream(openaiRequest);
  return toAnthropicStream(openaiStream); // 转回 Anthropic 格式
} else {
  // 现有逻辑完全不变
  return anthropicClient.beta.messages.stream(anthropicRequest);
}
```

---

## 不支持 / 降级处理的功能

OpenAI 模型不具备以下 Anthropic 专有功能，适配器会静默忽略：

| 功能                             | 处理方式             |
| -------------------------------- | -------------------- |
| Thinking / Extended Thinking     | 忽略，不发送相关参数 |
| Prompt Caching (`cache_control`) | 忽略                 |
| Effort 参数                      | 忽略                 |
| Beta headers                     | 忽略                 |

---

## 实现阶段

### Phase 1：基础接通（最小可运行）

- `providers.ts` 加 `openai` 类型
- `client.ts` 加 `getOpenAIClient()`
- `messageAdapter.ts` 实现文本消息转换
- `streamAdapter.ts` 实现文本流转换
- `claude.ts` 插入分支，文本对话可跑通

### Phase 2：工具调用

- `toolAdapter.ts` 实现工具定义转换
- `streamAdapter.ts` 补充工具调用 chunk 转换
- 验证 BashTool、FileEditTool 等可正常工作

### Phase 3：Ollama 本地模型

- Ollama 兼容 OpenAI API，复用 Phase 1/2 代码
- 仅需在 `client.ts` 里设置不同 base URL

---

## 涉及改动文件总结

| 文件                                         | 改动性质                           |
| -------------------------------------------- | ---------------------------------- |
| `src/utils/model/providers.ts`               | 小改，加两个 provider 类型         |
| `src/services/api/client.ts`                 | 小改，加 `getOpenAIClient()`       |
| `src/services/api/claude.ts`                 | 小改，加 provider 分支（约 20 行） |
| `src/services/api/adapter/messageAdapter.ts` | **新建**                           |
| `src/services/api/adapter/toolAdapter.ts`    | **新建**                           |
| `src/services/api/adapter/streamAdapter.ts`  | **新建**                           |

现有代码改动极少，适配器完全隔离，风险可控。
