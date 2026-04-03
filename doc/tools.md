# 工具系统（Tools）

对应源文件：`src/tools/`（40+ 工具目录）、`src/Tool.ts`（792 行）、`src/Task.ts`（125 行）

---

## 工具系统概览

工具是 Claude 与外部世界交互的唯一通道。每次 Claude 需要读文件、执行命令、搜索代码时，
都通过工具系统完成。工具系统由三层组成：

```text
Claude API 返回 tool_use block
         │
         ▼
   QueryEngine.executeToolUse()
         │
    ┌────┴────────────────────┐
    ▼                         ▼
canUseTool()          找到对应 Tool 实现
（权限检查）                   │
    │                         ▼
    └──────────────── tool.execute()
                              │
                              ▼
                    返回 tool_result 给 Claude
```

---

## 工具类型定义（Tool.ts）

```typescript
// 工具执行上下文（每次工具调用时注入）
type ToolUseContext = {
  options: {
    commands: Command[];
    tools: Tools;
    mcpClients: MCPServerConnection[];
    mainLoopModel: string;
    thinkingConfig: ThinkingConfig;
    maxBudgetUsd?: number;
    customSystemPrompt?: string;
  };
  abortController: AbortController;
  readFileState: FileStateCache; // 文件内容缓存
  getAppState(): AppState;
  setAppState(f): void;
};

// 权限上下文
type ToolPermissionContext = {
  mode: PermissionMode;
  alwaysAllowRules: ToolPermissionRulesBySource;
  alwaysDenyRules: ToolPermissionRulesBySource;
  alwaysAskRules: ToolPermissionRulesBySource;
  isBypassPermissionsModeAvailable: boolean;
};
```

---

## 工具分类详解

### 文件操作类

| 工具               | 目录                      | 说明                               |
| ------------------ | ------------------------- | ---------------------------------- |
| `FileReadTool`     | `tools/FileReadTool/`     | 读取文件内容（支持分页、行范围）   |
| `FileEditTool`     | `tools/FileEditTool/`     | 精确字符串替换编辑文件             |
| `FileWriteTool`    | `tools/FileWriteTool/`    | 创建或完整覆写文件                 |
| `GlobTool`         | `tools/GlobTool/`         | 按 glob 模式匹配文件路径           |
| `NotebookEditTool` | `tools/NotebookEditTool/` | 编辑 Jupyter `.ipynb` 笔记本单元格 |

**FileEditTool** 使用精确 `old_string → new_string` 替换，要求 `old_string` 在文件中唯一，
避免误改，是 Claude Code 最常用的编辑工具。

---

### 搜索类

| 工具                   | 目录                          | 说明                             |
| ---------------------- | ----------------------------- | -------------------------------- |
| `GrepTool`             | `tools/GrepTool/`             | 基于 ripgrep 的正则内容搜索      |
| `WebSearchTool`        | `tools/WebSearchTool/`        | 网络搜索（Bing / 搜索 API）      |
| `WebFetchTool`         | `tools/WebFetchTool/`         | HTTP 请求 + 网页内容抓取         |
| `ToolSearchTool`       | `tools/ToolSearchTool/`       | 搜索可用工具（延迟加载工具列表） |
| `ListMcpResourcesTool` | `tools/ListMcpResourcesTool/` | 列举 MCP 服务器资源              |
| `ReadMcpResourceTool`  | `tools/ReadMcpResourceTool/`  | 读取指定 MCP 资源内容            |

---

### 命令执行类

| 工具             | 目录                    | 说明                                          |
| ---------------- | ----------------------- | --------------------------------------------- |
| `BashTool`       | `tools/BashTool/`       | 执行 Shell 命令（最大 18 个相关文件，最复杂） |
| `PowerShellTool` | `tools/PowerShellTool/` | Windows PowerShell 命令执行                   |

**BashTool** 是权限管控最严格的工具，内置：

- 危险命令检测（`rm -rf`、`sudo` 等）
- 工作目录锁定
- 输出长度截断
- 超时控制

---

### Agent 与任务类

| 工具              | 目录                     | 说明                                 |
| ----------------- | ------------------------ | ------------------------------------ |
| `AgentTool`       | `tools/AgentTool/`       | 派生子 Claude Agent（17 个相关文件） |
| `TaskCreateTool`  | `tools/TaskCreateTool/`  | 创建后台任务                         |
| `TaskGetTool`     | `tools/TaskGetTool/`     | 查询任务状态                         |
| `TaskListTool`    | `tools/TaskListTool/`    | 列举所有任务                         |
| `TaskOutputTool`  | `tools/TaskOutputTool/`  | 获取任务输出流                       |
| `TaskStopTool`    | `tools/TaskStopTool/`    | 终止任务                             |
| `TaskUpdateTool`  | `tools/TaskUpdateTool/`  | 更新任务描述                         |
| `SendMessageTool` | `tools/SendMessageTool/` | 向队友 Agent 发送消息                |
| `TeamCreateTool`  | `tools/TeamCreateTool/`  | 创建 Agent 团队（Coordinator 模式）  |
| `TeamDeleteTool`  | `tools/TeamDeleteTool/`  | 解散 Agent 团队                      |

**AgentTool** 是实现"子 Agent"的核心，每次调用会启动一个独立的 Claude 对话循环，
拥有独立的工具权限和消息历史，完成后汇报结果给父 Agent。

---

### 调度与远程类

| 工具                | 目录                       | 说明                                  |
| ------------------- | -------------------------- | ------------------------------------- |
| `ScheduleCronTool`  | `tools/ScheduleCronTool/`  | 调度定时任务（含 Create/Delete/List） |
| `RemoteTriggerTool` | `tools/RemoteTriggerTool/` | 触发远程 Agent 执行                   |
| `SleepTool`         | `tools/SleepTool/`         | 暂停执行（主动式 / KAIROS 模式）      |

---

### MCP 与扩展类

| 工具          | 目录                 | 说明                                      |
| ------------- | -------------------- | ----------------------------------------- |
| `MCPTool`     | `tools/MCPTool/`     | 调用 MCP 服务器工具                       |
| `McpAuthTool` | `tools/McpAuthTool/` | MCP 服务器鉴权流程                        |
| `SkillTool`   | `tools/SkillTool/`   | 执行用户定义的 Skill（`.claude/skills/`） |
| `LSPTool`     | `tools/LSPTool/`     | Language Server Protocol 诊断集成         |

---

### 交互与 UI 类

| 工具                  | 目录                         | 说明                       |
| --------------------- | ---------------------------- | -------------------------- |
| `AskUserQuestionTool` | `tools/AskUserQuestionTool/` | 向用户提问（中断等待输入） |
| `EnterPlanModeTool`   | `tools/EnterPlanModeTool/`   | 进入计划模式（只读权限）   |
| `ExitPlanModeTool`    | `tools/ExitPlanModeTool/`    | 退出计划模式               |
| `EnterWorktreeTool`   | `tools/EnterWorktreeTool/`   | 进入 git worktree 隔离环境 |
| `ExitWorktreeTool`    | `tools/ExitWorktreeTool/`    | 退出 worktree              |
| `TodoWriteTool`       | `tools/TodoWriteTool/`       | 管理对话内任务清单         |
| `BriefTool`           | `tools/BriefTool/`           | 生成上下文摘要 brief       |
| `ConfigTool`          | `tools/ConfigTool/`          | 读写 Claude Code 配置      |

---

### 仅内部 / 实验性工具

| 工具                            | 说明                             |
| ------------------------------- | -------------------------------- |
| `REPLTool`                      | 交互式 REPL（`ANT_ONLY` 限制）   |
| `SyntheticOutputTool`           | 结构化 JSON 输出强制（SDK 模式） |
| `testing/TestingPermissionTool` | 权限测试（测试专用）             |

---

## 任务系统（Task.ts）

任务（Task）是对"异步后台工作单元"的抽象，用于 Agent、后台 Shell、工作流等。

### 任务类型与 ID 前缀

| 前缀 | 类型                  | 说明                |
| ---- | --------------------- | ------------------- |
| `b`  | `local_bash`          | 本地 Shell 命令任务 |
| `a`  | `local_agent`         | 本地子 Agent 进程   |
| `r`  | `remote_agent`        | 远程 Agent 任务     |
| `t`  | `in_process_teammate` | 同进程内队友 Agent  |
| `w`  | `local_workflow`      | 本地工作流          |
| `m`  | `monitor_mcp`         | MCP 监控任务        |
| `d`  | `dream`               | 实验性任务类型      |

任务 ID 格式：`{前缀}{8位随机字符}`，字符集为 `0-9a-z`，共 36^8 ≈ 2.8 万亿种组合。

### 任务生命周期

```text
pending → running → completed
                 ↘ failed
                 ↘ killed
```

`isTerminalTaskStatus()` 判断任务是否已终止（用于清理孤儿任务和防止死队友注入消息）。

### TaskStateBase 字段

```typescript
type TaskStateBase = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  description: string;
  toolUseId?: string; // 关联的工具调用 ID
  startTime: number;
  endTime?: number;
  totalPausedMs?: number; // 累计暂停时长
  outputFile: string; // 输出落盘路径
  outputOffset: number; // 已读取的输出偏移
  notified: boolean; // 是否已通知用户
};
```

---

## 工具注册机制

`src/tools.ts` 是工具工厂，在应用启动时聚合所有可用工具：

1. 根据功能开关过滤工具（如 `COORDINATOR_MODE` 才加载团队工具）
2. 注入 MCP 工具（动态，来自已连接的 MCP 服务器）
3. 返回 `Tools` 数组，注入到 `QueryEngineConfig.tools`
