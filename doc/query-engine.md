# 查询引擎（QueryEngine）

对应源文件：`src/QueryEngine.ts`（1295 行）、`src/query.ts`（1729 行）

---

## 职责

QueryEngine 是 Claude Code 的**核心大脑**，负责：

- 管理与 Claude API 的**多轮对话状态**
- 调度**工具调用**（Tool Use）并处理结果
- 追踪 **token 用量、API 成本、预算上限**
- 自动压缩**长对话历史**
- 管理**权限模式**与结构化输出

---

## 类结构（QueryEngine）

```typescript
class QueryEngine {
  // 配置：工具列表、命令、MCP 客户端、模型选择等
  private config: QueryEngineConfig;

  // 对话消息列表（跨轮持久化）
  private mutableMessages: Message[];

  // 中止控制器（支持 Ctrl+C 取消）
  private abortController: AbortController;

  // 权限拒绝记录（SDK 模式下上报）
  private permissionDenials: SDKPermissionDenial[];

  // 累计 token 用量
  private totalUsage: NonNullableUsage;

  // 文件状态缓存（避免重复读取）
  private readFileState: FileStateCache;

  // 技能发现追踪（每轮重置）
  private discoveredSkillNames: Set<string>;
}
```

### 核心方法

| 方法               | 说明                                 |
| ------------------ | ------------------------------------ |
| `submitMessage()`  | 提交新一轮用户消息，启动完整对话流程 |
| `query()`          | 向 Claude API 发送请求，处理流式响应 |
| `executeToolUse()` | 分发并执行工具调用                   |
| `autoCompact()`    | 判断并触发对话历史压缩               |

---

## 单轮对话生命周期

```text
submitMessage(userInput)
      │
      ├─ 预处理
      │    ├─ processUserInput()     解析附件、斜杠命令
      │    ├─ loadMemoryPrompt()     加载记忆提示词（memdir）
      │    └─ fetchSystemPromptParts() 获取系统提示各部分
      │
      ├─ 构建请求
      │    ├─ 拼接 system prompt
      │    ├─ 添加文件历史快照
      │    └─ 注入 MCP 资源
      │
      ├─ API 调用（query.ts）
      │    ├─ 流式接收 Claude 响应
      │    ├─ 处理 thinking block（扩展思考模式）
      │    └─ 归一化消息格式
      │
      ├─ 工具调用循环
      │    ├─ 解析 tool_use block
      │    ├─ 权限检查（canUseTool）
      │    ├─ 执行工具
      │    └─ 注入 tool_result，继续对话
      │
      └─ 收尾
           ├─ 更新 token 用量 / 成本
           ├─ 文件历史快照
           ├─ 记录 session transcript
           └─ 判断是否需要 autoCompact
```

---

## QueryEngineConfig 关键字段

```typescript
type QueryEngineConfig = {
  cwd: string; // 工作目录
  tools: Tools; // 可用工具列表
  commands: Command[]; // 可用命令
  mcpClients: MCPServerConnection[];
  agents: AgentDefinition[]; // Agent 定义（子 Agent 模式）
  canUseTool: CanUseToolFn; // 权限检查函数
  customSystemPrompt?: string; // 自定义系统提示（替换默认）
  appendSystemPrompt?: string; // 追加系统提示
  userSpecifiedModel?: string; // 用户指定模型
  maxTurns?: number; // 最大轮次限制
  maxBudgetUsd?: number; // 预算上限（美元）
  jsonSchema?: Record<string, unknown>; // 结构化输出 schema
  replayUserMessages?: boolean; // SDK 模式下重放消息
};
```

---

## 对话压缩机制

当对话历史超过阈值时，自动触发压缩以控制 token 消耗：

| 压缩策略        | 文件                                  | 说明                                  |
| --------------- | ------------------------------------- | ------------------------------------- |
| autoCompact     | `services/compact/autoCompact.ts`     | 基于 token 阈值自动触发               |
| reactiveCompact | `services/compact/reactiveCompact.ts` | 响应式、按需触发                      |
| snipCompact     | `services/compact/snipCompact.ts`     | 片段式压缩（`HISTORY_SNIP` 开关控制） |

压缩过程：

1. 调用 Claude 对历史对话生成摘要
2. 用摘要替换旧消息（保留最近 N 轮）
3. 插入 `SDKCompactBoundaryMessage` 标记边界
4. 触发 `pre_compact` / `post_compact` hook

---

## 权限模式

`PermissionMode` 控制工具执行前的授权行为：

| 模式                | 说明                           |
| ------------------- | ------------------------------ |
| `default`           | 危险操作需用户确认             |
| `acceptEdits`       | 文件编辑自动接受               |
| `bypassPermissions` | 跳过所有权限检查（需显式启用） |
| `plan`              | 计划模式，仅允许只读操作       |

---

## query.ts 的职责

`query.ts` 是 QueryEngine 的底层 API 通信层：

- 封装 `@anthropic-ai/sdk` 的 `messages.stream()` 调用
- 处理流式 SSE 事件（`content_block_delta`、`tool_use` 等）
- 实现**指数退避重试**（`categorizeRetryableAPIError`）
- 归一化响应为内部 `Message` 类型
- 处理 `thinking` block（Extended Thinking 模式）

---

## 成本追踪

`cost-tracker.ts` 提供：

```typescript
getModelUsage(); // 各模型 token 用量明细
getTotalCost(); // 累计 USD 成本
getTotalAPIDuration(); // 累计 API 耗时
```

成本数据在每轮对话结束后更新，并通过 `maxBudgetUsd` 参数实现预算熔断。
