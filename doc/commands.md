# 命令系统（Commands）

对应源文件：`src/commands.ts`（754 行）、`src/commands/`（103+ 命令目录）

---

## 概述

命令（Command）是用户在 REPL 中通过 `/` 前缀触发的功能，与工具（Tool）不同——
工具由 Claude 主动调用，命令由**用户显式触发**。

```text
用户输入 /commit
    │
    ▼
commands.ts getCommands()  查找 "commit" 命令
    │
    ▼
src/commands/commit.ts  执行实现逻辑
```

---

## 命令注册（commands.ts）

`getCommands()` 函数聚合所有命令并返回命令列表：

- 根据功能开关过滤（`ANT_ONLY`、`KAIROS`、`PROACTIVE`、远程模式等）
- 每个命令对象包含：`name`、`description`、`call()`、可选的 `aliases`
- 支持命令**别名**（如 `/exit` 同时支持 `/quit`）
- 远程模式（Bridge）下只暴露安全子集命令

---

## 完整命令列表

### 代码与 Git 类

| 命令                  | 文件                  | 说明                         |
| --------------------- | --------------------- | ---------------------------- |
| `/commit`             | `commit.ts`           | 生成 commit message 并提交   |
| `/commit-push-pr`     | `commit-push-pr.ts`   | 一键 commit + push + 创建 PR |
| `/branch`             | `branch/`             | 创建 / 切换 / 管理 Git 分支  |
| `/diff`               | `diff/`               | 查看 git diff 并格式化显示   |
| `/issue`              | `issue/`              | 查看 / 创建 GitHub Issue     |
| `/autofix-pr`         | `autofix-pr/`         | 自动修复 PR 中的问题         |
| `/install-github-app` | `install-github-app/` | 安装 GitHub App              |

### 会话管理类

| 命令       | 文件       | 说明                            |
| ---------- | ---------- | ------------------------------- |
| `/resume`  | `resume/`  | 恢复上一个对话会话              |
| `/clear`   | `clear/`   | 清空当前对话历史                |
| `/compact` | `compact/` | 手动触发对话压缩                |
| `/export`  | `export/`  | 导出对话历史（JSON / Markdown） |
| `/copy`    | `copy/`    | 复制最后一条响应到剪贴板        |
| `/exit`    | `exit/`    | 退出 Claude Code                |

### 配置与工具类

| 命令           | 文件           | 说明                  |
| -------------- | -------------- | --------------------- |
| `/config`      | `config/`      | 查看和修改配置项      |
| `/mcp`         | `mcp.tsx`      | 管理 MCP 服务器连接   |
| `/hooks`       | `hooks/`       | 管理 hooks 配置       |
| `/keybindings` | `keybindings/` | 自定义键绑定          |
| `/install`     | `install.tsx`  | 安装 Claude Code 组件 |
| `/doctor`      | `doctor/`      | 诊断环境与配置问题    |
| `/env`         | `env/`         | 查看环境变量          |

### 上下文与信息类

| 命令           | 文件           | 说明                       |
| -------------- | -------------- | -------------------------- |
| `/context`     | `context/`     | 查看当前上下文 token 用量  |
| `/ctx_viz`     | `ctx_viz/`     | 上下文可视化（token 分布） |
| `/cost`        | `cost/`        | 查看本次会话 API 费用      |
| `/files`       | `files/`       | 列举已读取的文件           |
| `/brief`       | `brief.ts`     | 生成当前会话摘要           |
| `/insights`    | `insights.ts`  | 使用洞察统计               |
| `/extra-usage` | `extra-usage/` | 详细 token 用量报告        |

### 模型与性能类

| 命令      | 文件      | 说明                       |
| --------- | --------- | -------------------------- |
| `/model`  | `config/` | 切换使用的 Claude 模型     |
| `/fast`   | `fast/`   | 切换 Fast 模式（更快响应） |
| `/effort` | `effort/` | 调整思考深度               |

### Agent 与工作流类

| 命令       | 文件       | 说明                           |
| ---------- | ---------- | ------------------------------ |
| `/agents`  | `agents/`  | 管理 Agent 定义（列表 / 创建） |
| `/add-dir` | `add-dir/` | 添加额外工作目录               |
| `/init`    | `init.ts`  | 初始化 CLAUDE.md 项目文件      |

### 调试与开发类（主要为内部使用）

| 命令               | 文件               | 说明                 |
| ------------------ | ------------------ | -------------------- |
| `/debug-tool-call` | `debug-tool-call/` | 调试工具调用         |
| `/ant-trace`       | `ant-trace/`       | Anthropic 内部追踪   |
| `/btw`             | `btw/`             | 附加背景信息         |
| `/heapdump`        | `heapdump/`        | 生成 Node.js 堆快照  |
| `/break-cache`     | `break-cache/`     | 清除提示缓存         |
| `/bughunter`       | `bughunter/`       | 自动 bug 搜索        |
| `/good-claude`     | `good-claude/`     | 正向反馈（ANT 内部） |
| `/advisor`         | `advisor.ts`       | AI 顾问模式          |

### 集成与平台类

| 命令                 | 文件                 | 说明              |
| -------------------- | -------------------- | ----------------- |
| `/ide`               | `ide/`               | IDE 集成配置      |
| `/desktop`           | `desktop/`           | 桌面端相关        |
| `/chrome`            | `chrome/`            | Chrome 浏览器集成 |
| `/install-slack-app` | `install-slack-app/` | 安装 Slack 集成   |
| `/feedback`          | `feedback/`          | 提交反馈          |
| `/help`              | `help/`              | 显示帮助信息      |

### 实验性命令（功能开关控制）

| 命令                 | 开关          | 说明            |
| -------------------- | ------------- | --------------- |
| `/bridge`            | `BRIDGE_MODE` | 桥接模式管理    |
| `/teleport`          | `KAIROS`      | KAIROS 主动模式 |
| `/color`             | 内部          | 主题颜色设置    |
| `/backfill-sessions` | ANT           | 历史会话回填    |

---

## 斜杠命令与技能的关系

技能（Skill）文件（`.claude/skills/*/SKILL.md`）通过 `SkillTool` 以工具方式执行，
但也可以通过 `/skill-name` 的形式作为斜杠命令触发。
`getSlashCommandToolSkills()` 负责将技能目录扫描结果注入命令列表。

---

## 命令 vs 工具 对比

| 维度     | 命令（Command）     | 工具（Tool）                 |
| -------- | ------------------- | ---------------------------- |
| 触发方   | 用户（`/xxx`）      | Claude AI                    |
| 执行时机 | 用户输入时立即      | 对话轮次中                   |
| 权限检查 | 无（用户显式操作）  | 有（`canUseTool`）           |
| 呈现方式 | 终端 UI 组件        | Claude 响应中 tool_use block |
| 典型用途 | 会话管理、配置、Git | 文件操作、代码搜索、命令执行 |
