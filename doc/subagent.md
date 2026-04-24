# Subagent 激活机制

Agent 是**调用时临时搭建**的，不存在预先启动的常驻实例。没有进程池、没有预热、没有持久连接。每次调用都是一个临时的 `query()` async generator，用完即弃。`AgentDefinition` 本身只是声明式配置，不占运行时资源。

---

## 1. 整体流程

```
Claude 决定用 Agent 工具
  │
  ▼
AgentTool.call()                     ← 入口
  ├─ 路由决策（Normal / Fork / Teammate）
  ├─ 构建 System Prompt
  ├─ 组装工具池
  ├─ 创建隔离 ToolUseContext
  ├─ 创建 agentId
  │
  ▼
runAgent()                           ← async generator
  ├─ 获取 userContext / systemContext
  ├─ 裁剪 context（Explore/Plan 跳过 claudeMd、gitStatus）
  ├─ createSubagentContext()
  ├─ 执行 SubagentStart hooks
  │
  ▼
query() 循环                          ← 同进程独立对话循环
  ├─ API 请求（独立 system prompt + context）
  ├─ assistant 响应 → tool_use → 执行工具 → 下一轮
  └─ 无 tool_use 或达 maxTurns → 结束
  │
  ▼
结果回传 → 释放资源
```

---

## 2. 入口 — AgentTool.call()

> `src/tools/AgentTool/AgentTool.tsx:239`

API 返回 `tool_use` block，参数包括 `prompt`、`subagent_type`、`model`、`run_in_background`、`isolation`。框架调用 `call()` 进入。

### 路由决策（line 318-341）

| 条件                                   | 路径         | 行为                                                            |
| -------------------------------------- | ------------ | --------------------------------------------------------------- |
| `subagent_type` 指定                   | **Normal**   | 从 `agentDefinitions.activeAgents` 查找匹配的 `AgentDefinition` |
| `subagent_type` 未指定 + fork 实验开启 | **Fork**     | 使用 `FORK_AGENT` 定义                                          |
| `team_name` + `name`                   | **Teammate** | 走 `spawnTeammate()`                                            |

---

## 3. System Prompt 构建

> `src/tools/AgentTool/AgentTool.tsx:483-541`

| 路径                      | System Prompt                                                                                 | Prompt Messages                                                                                | 目的                                    |
| ------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Fork** (line 495-512)   | **继承父级** `renderedSystemPrompt`（fallback 重算 `buildEffectiveSystemPrompt()`）           | `buildForkedMessages()` — 克隆父级完整 assistant message + placeholder tool_results + 子级指令 | 字节级相同 API 前缀 → prompt cache 命中 |
| **Normal** (line 514-541) | 子 agent **自己的** `selectedAgent.getSystemPrompt()` + `enhanceSystemPromptWithEnvDetails()` | `createUserMessage({ content: prompt })`                                                       | 独立 system prompt                      |

---

## 4. 工具池组装

> `src/tools/AgentTool/agentToolUtils.ts:122-225` — `resolveAgentTools()`
> `src/tools/AgentTool/AgentTool.tsx:573-577`

- 根据子 agent 的 `permissionMode`（默认 `acceptEdits`）独立调用 `assembleToolPool()`
- **不继承**父级的工具限制
- `resolveAgentTools()` 再按 agent 定义的 `allowedTools` / `disallowedTools` 过滤
- Fork 路径用 `useExactTools=true`，直接使用父级完整工具池（保持缓存一致性）

---

## 5. 隔离上下文创建

> `src/utils/forkedAgent.ts:345-462` — `createSubagentContext()`

| 属性                             | 处理方式                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| `readFileState`                  | 克隆父级缓存（fork）或新建空缓存（normal）                              |
| `nestedMemoryAttachmentTriggers` | 全新空 Set                                                              |
| `abortController`                | sync → 子级链接父级（父取消子也取消）；async → 独立新建                 |
| `agentId`                        | `createAgentId()` 生成唯一 ID，格式 `a{16_hex}`                         |
| `queryTracking.depth`            | 父级 depth + 1                                                          |
| `setAppState`                    | sync → 共享父级；async → no-op（完全隔离）                              |
| `getAppState`                    | 包装后注入 `shouldAvoidPermissionPrompts`（async agent 不弹权限对话框） |
| UI 回调                          | 全部 `undefined`（子 agent 无法控制父级 UI）                            |

### User/System Context 裁剪

> `src/tools/AgentTool/runAgent.ts:380-410`

- `omitClaudeMd` agent（Explore、Plan）跳过 `claudeMd`，节省 token
- Explore / Plan 还跳过 `gitStatus`（最多 40KB 过时数据）

---

## 6. query() 循环

> `src/tools/AgentTool/runAgent.ts:748-800`

```typescript
for await (const message of query({
  messages: initialMessages,
  systemPrompt: agentSystemPrompt,
  userContext: resolvedUserContext,
  systemContext: resolvedSystemContext,
  canUseTool,
  toolUseContext: agentToolUseContext,
  querySource,
  maxTurns: maxTurns ?? agentDefinition.maxTurns,
})) { ... }
```

子 agent 调用的是**同一个 `query()` 函数**，在当前进程内以 async generator 运行独立对话循环：

1. 发送 API 请求（独立 system prompt + context）
2. 接收 assistant 响应
3. 有 tool_use → 执行工具 → 结果追加为 user message → 下一轮
4. 无 tool_use 或达 `maxTurns` → 结束

---

## 7. 结果回传与生命周期

> `src/tools/AgentTool/agentToolUtils.ts:276-300` — `finalizeAgentTool()`

| 模式                                  | 执行方式                                             | 结果回传                                                                                               |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Sync**（默认）                      | 阻塞父级 turn，等子 agent 完成                       | `finalizeAgentTool()` 提取最后 assistant message 的 text blocks，作为 tool_result 返回                 |
| **Async**（`run_in_background=true`） | `registerAsyncAgent()` 注册后台任务，`void` 分离执行 | 立即返回 `async_launched`；完成后 `enqueueAgentNotification()` 以 `<task-notification>` 注入父级下一轮 |

---

## 8. Worktree 隔离

> `src/tools/AgentTool/AgentTool.tsx:590-602`

- `isolation: "worktree"` → `createAgentWorktree("agent-{id前8位}")`
- 子 agent 在独立 git worktree 中工作
- 无变更 → 自动清理 worktree
- 有变更 → 保留路径和分支信息

---

## 9. Sidechain 记录

> `src/tools/AgentTool/runAgent.ts:735-742`

子 agent 所有消息异步写入 sidechain transcript（`recordSidechainTranscript()`），用于：

- Resume（恢复中断的子 agent）
- Perfetto 追踪可视化

---

## 关键文件索引

| 文件                                    | 职责                      |
| --------------------------------------- | ------------------------- |
| `src/tools/AgentTool/AgentTool.tsx`     | 入口，路由/派生 agent     |
| `src/tools/AgentTool/runAgent.ts`       | 子 agent query 循环       |
| `src/utils/forkedAgent.ts`              | Fork 上下文 & 缓存共享    |
| `src/tools/AgentTool/forkSubagent.ts`   | Fork 专属逻辑             |
| `src/tools/AgentTool/agentToolUtils.ts` | 工具解析 & 结果打包       |
| `src/tools/AgentTool/agentContext.ts`   | AsyncLocalStorage 追踪    |
| `src/utils/uuid.ts`                     | `createAgentId()` ID 生成 |
| `src/tools/AgentTool/worktree.ts`       | Git worktree 隔离         |
