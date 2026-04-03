# 服务层（Services）

对应源文件：`src/services/`（38+ 服务模块）

---

## 服务层职责

服务层是 Claude Code 与外部系统（Claude API、MCP 服务器、OAuth 平台、分析平台等）
交互的统一封装，为 QueryEngine 和工具提供能力支撑。

---

## Claude API 服务（`services/api/`）

### 核心文件

| 文件           | 职责                                                 |
| -------------- | ---------------------------------------------------- |
| `claude.ts`    | Claude API 客户端主入口，封装 `@anthropic-ai/sdk`    |
| `errors.ts`    | API 错误分类（可重试 / 不可重试），指数退避逻辑      |
| `logging.ts`   | 请求 / 响应日志，token 用量类型定义                  |
| `filesApi.ts`  | 文件上传 / 下载（`Files API`）                       |
| `withRetry.ts` | 通用重试装饰器（基于 `categorizeRetryableAPIError`） |
| `bootstrap.ts` | 会话启动数据预加载（并行减少延迟）                   |

### API 调用流程

```text
query.ts 发起流式请求
    │
    ▼
claude.ts  构建请求体
    │
    ├─ 注入 system prompt
    ├─ 序列化消息列表
    └─ 设置模型、max_tokens、thinking config
    │
    ▼
@anthropic-ai/sdk messages.stream()
    │
    ▼
withRetry()  可重试错误自动重试（网络超时、429、529 等）
    │
    ▼
errors.ts  不可重试错误（401、400 等）直接抛出
```

### 错误分类（errors.ts）

| 错误类型            | 处理方式               |
| ------------------- | ---------------------- |
| 网络超时 / 连接重置 | 自动重试（指数退避）   |
| `529`（过载）       | 自动重试               |
| `429`（限流）       | 重试 + 显示限流提示    |
| `401`（未授权）     | 直接报错，提示重新登录 |
| `400`（请求错误）   | 直接报错               |

---

## MCP 服务（`services/mcp/`）

Model Context Protocol（MCP）是 Claude Code 的工具扩展协议，
允许用户接入第三方 MCP 服务器来扩展工具能力。

| 文件                  | 职责                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `client.ts`           | MCP 客户端编排，管理多个服务器连接                                       |
| `types.ts`            | MCP 配置类型：`MCPServerConfig`、`MCPServerConnection`、`ServerResource` |
| `officialRegistry.ts` | Anthropic 官方 MCP 服务器注册表                                          |

### MCP 服务器类型

| 类型        | 说明                           |
| ----------- | ------------------------------ |
| `stdio`     | 通过标准输入输出通信的本地进程 |
| `sse`       | Server-Sent Events HTTP 服务   |
| `websocket` | WebSocket 服务                 |

MCP 工具在运行时动态注入到工具列表，每个 MCP 工具名格式为 `mcp__{server}__{tool}`。

---

## 分析服务（`services/analytics/`）

| 文件            | 职责                                        |
| --------------- | ------------------------------------------- |
| `growthbook.ts` | GrowthBook 功能开关客户端（A/B 测试、灰度） |
| `index.ts`      | 事件日志（`logEvent`）统一入口              |
| `sink.ts`       | 分析事件聚合与上报                          |
| `config.ts`     | 分析配置（端点、采样率等）                  |

GrowthBook 用于控制实验性功能的灰度发布，可在不重新发布的情况下为特定用户启用新功能。

---

## 消息压缩服务（`services/compact/`）

| 文件                 | 策略       | 触发条件                                |
| -------------------- | ---------- | --------------------------------------- |
| `autoCompact.ts`     | 自动压缩   | token 超过阈值（默认上下文窗口的 ~80%） |
| `compact.ts`         | 手动压缩   | 用户执行 `/compact` 命令                |
| `reactiveCompact.ts` | 响应式压缩 | API 返回 context window 相关错误时      |
| `snipCompact.ts`     | 片段压缩   | `HISTORY_SNIP` 功能开关启用（SDK 模式） |
| `snipProjection.ts`  | 片段投影   | REPL 模式下按需投影压缩视图             |

**压缩过程：**

1. 将旧消息发给 Claude 生成摘要
2. 用摘要消息替换旧消息列表
3. 保留最近 N 轮完整对话
4. 触发 `pre_compact` / `post_compact` hooks（允许用户脚本干预）

---

## OAuth 服务（`services/oauth/`）

支持多种鉴权方式：

| 方式             | 说明                                  |
| ---------------- | ------------------------------------- |
| Claude.ai OAuth  | 通过 claude.ai 网页授权（推荐）       |
| API Key          | 直接使用 `ANTHROPIC_API_KEY` 环境变量 |
| AWS Bedrock      | 通过 AWS IAM 身份鉴权                 |
| Google Vertex AI | 通过 GCP 身份鉴权                     |

鉴权令牌存储在系统 keychain（macOS Keychain / Windows Credential Store）中。

---

## 语言服务器协议（`services/lsp/`）

集成 LSP 支持，允许 Claude 获取编辑器级别的诊断信息：

- 读取 IDE 提供的代码诊断（错误、警告）
- 通过 `LSPTool` 在工具调用中呈现给 Claude
- 支持 VS Code、JetBrains 等 IDE 扩展集成

---

## 插件服务（`services/plugins/`）

Claude Code 支持插件扩展机制：

- 插件存储在 `~/.claude/plugins/` 或项目 `.claude/plugins/` 下
- 插件可以注册新工具、新命令、hooks
- `pluginLoader.ts` 在启动时扫描并加载插件

---

## 策略限制（`services/policyLimits/`）

面向企业部署的约束执行系统：

- 通过 MDM（Mobile Device Management）下发配置
- 可限制：允许的工具、最大预算、禁止的文件路径等
- `remoteManagedSettings/` 负责从远程获取并缓存策略配置

---

## 其他服务

| 服务       | 文件                             | 说明                           |
| ---------- | -------------------------------- | ------------------------------ |
| Agent 摘要 | `AgentSummary/`                  | 子 Agent 执行摘要生成          |
| 内存提取   | `extractMemories/`               | 从对话中自动提取记忆           |
| 会话记忆   | `SessionMemory/`                 | 会话级记忆持久化               |
| 速率限制   | `claudeAiLimits.ts`              | Claude.ai 用量限制追踪         |
| 提示建议   | `PromptSuggestion/`              | 输入框自动补全建议             |
| Token 估算 | `tokenEstimation.ts`             | 发送前预估 token 用量          |
| 通知       | `notifier.ts`                    | 系统通知（macOS 通知中心等）   |
| 语音       | `voice.ts` / `voiceStreamSTT.ts` | 语音输入（STT）支持            |
| VCR        | `vcr.ts`                         | 录制 / 回放 API 请求（测试用） |
| 设置同步   | `settingsSync/`                  | 多设备设置同步                 |
| 睡眠防止   | `preventSleep.ts`                | 防止系统在任务执行期间休眠     |
