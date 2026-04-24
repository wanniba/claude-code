# Context Injection 全景

Claude Code 向 Claude API 发送的每个请求，由三层注入内容组成：**System Prompt**、**User/System Context**、**Attachments**（`<system-reminder>` 标签）。本文档按注入时机和位置，完整列出所有内容类型及其代码路径。

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  API Request                                                │
│                                                             │
│  system: [                                                  │
│    { text: static_sections,  cache: 'global' }  ← 跨组织缓存 │
│    ─── SYSTEM_PROMPT_DYNAMIC_BOUNDARY ───                   │
│    { text: dynamic_sections, cache: null    }  ← 每次重算    │
│  ]                                                          │
│                                                             │
│  messages: [                                                │
│    { role: user,  content: [                                │
│        userContext (claudeMd, currentDate, gitStatus)        │
│        + user input                                         │
│        + attachments (<system-reminder> 标签)                │
│    ]}                                                       │
│    ...conversation history...                               │
│  ]                                                          │
└─────────────────────────────────────────────────────────────┘
```

组装入口：`src/utils/queryContext.ts:43` — `fetchSystemPromptParts()`，并行获取三部分：

| 部分                | 来源函数             | 缓存策略       |
| ------------------- | -------------------- | -------------- |
| defaultSystemPrompt | `getSystemPrompt()`  | 会话级 memoize |
| userContext         | `getUserContext()`   | 会话级 memoize |
| systemContext       | `getSystemContext()` | 会话级 memoize |

缓存分割逻辑见 `src/utils/api.ts:321` — `splitSysPromptPrefix()`，在 boundary 标记处切分为 `cacheScope='global'`（静态）和 `cacheScope=null`（动态）两个 block。

---

## 2. System Prompt — 静态段（boundary 前）

> 代码：`src/constants/prompts.ts:513-523`

这些 section 内容不随会话变化，可跨组织缓存。

| #   | Section           | 函数                             | 内容                                                                  |
| --- | ----------------- | -------------------------------- | --------------------------------------------------------------------- |
| 1   | Intro             | `getSimpleIntroSection()`        | 身份声明（"You are Claude Code"）+ 工具使用指令 + cyber risk 安全警告 |
| 2   | System            | `getSimpleSystemSection()`       | 工具权限机制、`<system-reminder>` 标签说明、自动压缩提示              |
| 3   | Doing Tasks       | `getSimpleDoingTasksSection()`   | 编码标准：不 mock 数据、不加多余功能、安全规范、UI 验证要求等         |
| 4   | Actions           | `getActionsSection()`            | 操作风险评估框架：可逆/不可逆操作、需确认场景                         |
| 5   | Using Your Tools  | `getUsingYourToolsSection()`     | 工具使用指南：Read > cat、Edit > sed、Grep > grep、并行调用策略       |
| 6   | Tone and Style    | `getSimpleToneAndStyleSection()` | 沟通风格：不主动用 emoji、引用格式 `file:line`、简洁回复              |
| 7   | Output Efficiency | `getOutputEfficiencySection()`   | 输出效率指令（ant 用户有独立变体）                                    |

---

## 3. System Prompt — 动态段（boundary 后）

> 代码：`src/constants/prompts.ts:457-509`，通过 `systemPromptSection()` 注册，`resolveSystemPromptSections()` 异步解析。

| #   | Section Key              | 函数                                  | 内容                                                        |
| --- | ------------------------ | ------------------------------------- | ----------------------------------------------------------- |
| 1   | `session_guidance`       | `getSessionSpecificGuidanceSection()` | Agent 工具使用指南、AskUserQuestion 指引、可用 Skill 列表   |
| 2   | `memory`                 | `loadMemoryPrompt()`                  | auto memory 指令：MEMORY.md 索引 + memory 读写规范          |
| 3   | `ant_model_override`     | `getAntModelOverrideSection()`        | ant-only：GrowthBook 下发的模型特定 system prompt 后缀      |
| 4   | `env_info_simple`        | `computeSimpleEnvInfo()`              | 环境信息（详见 [4. 环境信息](#4-环境信息)）                 |
| 5   | `language`               | `getLanguageSection()`                | 用户语言偏好（settings 配置）                               |
| 6   | `output_style`           | `getOutputStyleSection()`             | 自定义输出风格配置                                          |
| 7   | `mcp_instructions`       | `getMcpInstructionsSection()`         | MCP 服务器指令（delta 模式关闭时，每轮重算，**不可缓存**）  |
| 8   | `scratchpad`             | `getScratchpadInstructions()`         | 临时文件目录指令                                            |
| 9   | `frc`                    | `getFunctionResultClearingSection()`  | Function Result Clearing 规则（压缩模式下清理旧工具结果）   |
| 10  | `summarize_tool_results` | `SUMMARIZE_TOOL_RESULTS_SECTION`      | 指示模型在工具结果被清理前保存关键信息                      |
| 11  | `numeric_length_anchors` | (inline)                              | ant-only：输出长度锚定（工具间 <=25 词，最终回复 <=100 词） |
| 12  | `token_budget`           | (inline)                              | TOKEN_BUDGET feature：当用户指定 token 目标时的持续工作指令 |
| 13  | `brief`                  | `getBriefSection()`                   | KAIROS feature：Brief 工具指令                              |

特殊：MCP instructions 使用 `DANGEROUS_uncachedSystemPromptSection` 包装，因为 MCP 服务器可能在 turn 间连接/断开。

---

## 4. 环境信息

> 代码：`src/constants/prompts.ts:599-650` — `computeSimpleEnvInfo()`

注入位置：system prompt 动态段 `env_info_simple`

| 字段              | 来源                | 示例                                 |
| ----------------- | ------------------- | ------------------------------------ |
| Working directory | `getCwd()`          | `/Users/sktlab/code/spq/claude-code` |
| Is git repo       | `getIsGit()`        | `true`                               |
| Platform          | `process.platform`  | `darwin`                             |
| Shell             | `process.env.SHELL` | `zsh`                                |
| OS Version        | `os.version()`      | `Darwin 25.4.0`                      |
| Model name        | model 参数          | `claude-opus-4-6[1m]`                |
| Knowledge cutoff  | 模型映射表          | `May 2025`                           |
| Additional dirs   | `--add-dir` 参数    | 额外工作目录列表                     |

---

## 5. User Context / System Context

> 代码：`src/context.ts:115-188`

注入位置：API 请求的首条 user message 前缀，以 `# key\ncontent` 格式拼接。

### 5.1 System Context — `getSystemContext()`

| Key            | 来源             | 内容                                                                                 |
| -------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `gitStatus`    | `getGitStatus()` | 当前分支、主分支、git user、`git status --short`（截断 2000 字符）、最近 5 条 commit |
| `cacheBreaker` | ant-only debug   | 缓存调试注入（BREAK_CACHE_COMMAND feature）                                          |

跳过条件：`CLAUDE_CODE_REMOTE` 环境变量、`shouldIncludeGitInstructions()` 返回 false。

### 5.2 User Context — `getUserContext()`

| Key           | 来源                                  | 内容                                                                              |
| ------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `claudeMd`    | `getMemoryFiles()` → `getClaudeMds()` | 所有 CLAUDE.md / rules 文件内容（详见 [6. CLAUDE.md 加载链](#6-claudemd-加载链)） |
| `currentDate` | `getLocalISODate()`                   | `Today's date is 2026-04-23.`                                                     |
| `userEmail`   | settings                              | 用户邮箱地址                                                                      |

禁用：`CLAUDE_CODE_DISABLE_CLAUDE_MDS` 环境变量 或 `--bare` 模式（无 `--add-dir`）。

---

## 6. CLAUDE.md 加载链

> 代码：`src/utils/claudemd.ts:790-1074` — `getMemoryFiles()`

按优先级从低到高加载，后面的覆盖前面的：

| 优先级 | 类别                | 路径                                                                    | 函数                                       |
| ------ | ------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| 1      | Managed（系统策略） | `/etc/claude-code/CLAUDE.md` + `/etc/claude-code/.claude/rules/*.md`    | `processMemoryFile()` + `processMdRules()` |
| 2      | User（全局用户）    | `~/.claude/CLAUDE.md` + `~/.claude/rules/*.md`                          | 同上                                       |
| 3      | Project（项目级）   | 从 CWD 向上遍历：`CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/*.md` | 同上                                       |
| 4      | Local（私有本地）   | `CLAUDE.local.md`（同层遍历）                                           | `processMemoryFile()`                      |
| 5      | Additional dirs     | `--add-dir` 指定目录，同 Project 级发现逻辑                             | 同上                                       |
| 6      | AutoMem             | `MEMORY.md` 入口 + memory 文件                                          | `getAutoMemEntrypoint()`                   |
| 7      | TeamMem             | 团队共享 memory（feature gate）                                         | `teamMemPaths.getTeamMemEntrypoint()`      |

### Rules 文件处理 — `processMdRules()`

- 递归扫描 `.claude/rules/*.md`
- 支持 frontmatter `paths` 字段做条件匹配（glob 模式）
- 无条件 rules 立即加载，有条件 rules 在触及匹配文件时才注入

### @include 指令 — `extractIncludePathsFromTokens()`

- 语法：`@path`、`@./relative`、`@~/home`、`@/absolute`
- 最大嵌套深度：5 层
- 仅在叶文本节点生效（代码块内忽略）

---

## 7. Attachments（中间轮注入）

> 代码：`src/utils/attachments.ts:743-1002` — `getAttachments()`

Attachments 以 `<system-reminder>` 标签形式注入到用户消息中，分三批并行处理：

### 7.1 用户输入 Attachments（首先处理）

| Key                  | 触发条件                           | 内容                      |
| -------------------- | ---------------------------------- | ------------------------- |
| `at_mentioned_files` | 用户 `@file` 引用                  | 被提及文件的内容          |
| `mcp_resources`      | 用户 `@mcp_resource`               | MCP 资源内容              |
| `agent_mentions`     | 用户 `@agent-xxx`                  | Agent 引用处理            |
| `skill_discovery`    | Turn 0 + EXPERIMENTAL_SKILL_SEARCH | 基于输入的 skill 自动发现 |

### 7.2 线程安全 Attachments（主线程 + 子 agent 共用）

| Key                                | 触发条件                                             | 内容                                      |
| ---------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `queued_commands`                  | 队列中有待处理 prompt                                | 排队的命令/通知                           |
| `date_change`                      | 跨午夜检测                                           | 日期变更提醒                              |
| `ultrathink_effort`                | 用户输入含 `@ultrathink`                             | 深度思考指令                              |
| `deferred_tools_delta`             | 工具集变化                                           | 新增/移除的工具 schema 差量               |
| `agent_listing_delta`              | Agent 池变化                                         | Agent 列表差量                            |
| `mcp_instructions_delta`           | MCP 服务器连接变化                                   | MCP 指令差量（delta 模式启用时）          |
| `companion_intro`                  | BUDDY feature                                        | Companion 介绍                            |
| `changed_files`                    | 文件变更触发                                         | 嵌套 memory 重加载（条件 rules 匹配检查） |
| `nested_memory`                    | 目标路径匹配条件 rules                               | 路径相关的条件 CLAUDE.md/rules            |
| `dynamic_skill`                    | 运行时发现 `.claude/skills/`                         | 动态加载的 skill                          |
| `skill_listing`                    | 每轮                                                 | 所有可用 skill 列表                       |
| `plan_mode`                        | 处于 Plan 模式                                       | Plan 执行提醒（每 5 轮完整版/精简版交替） |
| `plan_mode_exit`                   | 退出 Plan 模式                                       | 一次性退出通知                            |
| `auto_mode` / `auto_mode_exit`     | TRANSCRIPT_CLASSIFIER                                | 自动模式状态                              |
| `todo_reminders` / `task_reminder` | 有待办任务                                           | 任务提醒                                  |
| `teammate_mailbox`                 | Agent Swarms                                         | 队友消息邮箱                              |
| `team_context`                     | Agent Swarms                                         | 团队元数据                                |
| `agent_pending_messages`           | Coordinator 模式                                     | 待处理的 agent 消息                       |
| `critical_system_reminder`         | `ToolUseContext.criticalSystemReminder_EXPERIMENTAL` | 自定义关键提醒                            |
| `compaction_reminder`              | COMPACTION_REMINDERS feature                         | 压缩提醒                                  |
| `context_efficiency`               | HISTORY_SNIP feature                                 | 上下文效率提示                            |

### 7.3 主线程专用 Attachments

| Key                    | 触发条件             | 内容                     |
| ---------------------- | -------------------- | ------------------------ |
| `ide_selection`        | IDE 有选中内容       | 选中的代码行             |
| `ide_opened_file`      | IDE 打开文件         | 打开的文件 + 嵌套 memory |
| `output_style`         | 非默认输出风格       | 输出风格配置             |
| `diagnostics`          | 有类型错误/lint      | 诊断信息                 |
| `lsp_diagnostics`      | LSP 有诊断           | Language Server 诊断     |
| `unified_tasks`        | 有任务列表           | 统一任务视图             |
| `async_hook_responses` | Hook 执行完成        | Hook 异步响应结果        |
| `token_usage`          | TOKEN_BUDGET feature | 当前 token 使用量        |
| `budget_usd`           | 设置了费用预算       | 费用追踪                 |
| `output_token_usage`   | 每轮                 | 输出 token 统计          |
| `verify_plan_reminder` | 有 Plan 待验证       | Plan 验证检查提醒        |

---

## 8. MCP 指令注入

> 代码：`src/utils/mcpInstructionsDelta.ts:55-130`

两种模式：

| 模式       | 注入位置                                | 缓存影响               | 启用条件                                                               |
| ---------- | --------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| **Legacy** | System Prompt 动态段 `mcp_instructions` | 每轮重算，**破坏缓存** | 默认                                                                   |
| **Delta**  | Attachment `mcp_instructions_delta`     | 仅在变化时注入差量     | `tengu_basalt_3kr` gate / ant-only / `CLAUDE_CODE_MCP_INSTR_DELTA` env |

Delta 模式通过扫描历史消息中的 `mcp_instructions_delta` attachment 重建已公告服务器集合，只发送新增/移除的差量。

---

## 9. Compaction（压缩重注入）

> 代码：`src/services/compact/compact.ts:550-610`

Context 接近上限时触发压缩（自动或手动 `/compact`），压缩后重新注入以下内容：

| 重注入项               | 说明                                |
| ---------------------- | ----------------------------------- |
| Deferred Tools Delta   | 完整工具集（对比空历史 = 全量公告） |
| Agent Listing Delta    | 完整 agent 池                       |
| MCP Instructions Delta | 完整 MCP 指令                       |
| Plan Attachment        | 当前 Plan（如有）                   |
| Plan Mode Attachment   | Plan 模式状态（如在 plan 模式中）   |
| Skill Attachment       | 已调用的 skill                      |
| Session Start Hooks    | 重新执行 session_start hooks        |

压缩时同步清理：`readFileState` 缓存、memory 文件缓存（`clearMemoryFileCaches()`）。

---

## 10. 特殊注入

| 内容                   | 代码位置                                | 注入方式                                   |
| ---------------------- | --------------------------------------- | ------------------------------------------ |
| Cyber Risk Instruction | `src/constants/cyberRiskInstruction.ts` | System Prompt Intro 段内嵌                 |
| Proactive/KAIROS 指令  | `src/proactive/index.ts`                | 替换整个 system prompt 结构（独立分支）    |
| Coordinator 模式       | `src/utils/systemPrompt.ts:41-123`      | `buildEffectiveSystemPrompt()` 覆盖/追加   |
| Custom System Prompt   | `--system-prompt` 参数                  | 替换默认 system prompt，跳过 systemContext |
| Append System Prompt   | `--append-system-prompt` 参数           | 追加到 system prompt 末尾                  |

---

## 11. 控制注入的环境变量

| 环境变量                                       | 效果                                      |
| ---------------------------------------------- | ----------------------------------------- |
| `CLAUDE_CODE_SIMPLE`                           | 极简 system prompt（仅身份 + CWD + 日期） |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS`               | 完全禁用 CLAUDE.md 加载                   |
| `CLAUDE_CODE_DISABLE_ATTACHMENTS`              | 禁用所有 attachments                      |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | 额外 CLAUDE.md 加载目录                   |
| `CLAUDE_CODE_REMOTE`                           | CCR 模式，跳过 git status                 |
| `CLAUDE_CODE_MCP_INSTR_DELTA`                  | 强制启用/禁用 MCP delta 模式              |
| `CLAUDE_CODE_EXTRA_BODY`                       | 额外 API 请求体参数（JSON）               |
| `DISABLE_PROMPT_CACHING`                       | 全局禁用 prompt cache                     |
| `USER_TYPE=ant`                                | 启用 ant-only 实验功能                    |

---

## 12. 注入时序总览

```
Session Start
  │
  ├─ getSystemPrompt()          → system prompt (static + dynamic)
  ├─ getSystemContext()          → gitStatus, cacheBreaker
  ├─ getUserContext()            → claudeMd, currentDate
  │
  ▼
Each Turn
  │
  ├─ splitSysPromptPrefix()     → system prompt → API blocks (缓存分割)
  ├─ getAttachments()           → <system-reminder> 标签注入到 user message
  │   ├─ User Input batch       → @mentions, skill discovery
  │   ├─ Thread-safe batch      → tools delta, MCP delta, nested memory, skills, tasks...
  │   └─ Main-thread batch      → IDE, diagnostics, output style, token usage...
  │
  ▼
On Compaction
  │
  ├─ summarize old messages     → 压缩摘要替换历史
  ├─ re-inject deltas           → tools, agents, MCP (full set)
  ├─ re-inject state            → plan, skills, hooks
  └─ clear caches               → memory files, readFileState
```
