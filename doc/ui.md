# 终端 UI（Components & Ink）

对应源文件：`src/components/`（146+ 组件）、`src/ink/`、`src/vim/`、`src/hooks/`

---

## 技术栈

Claude Code 的终端界面基于 **[Ink](https://github.com/vadimdemedes/ink)** 框架，
使用 React 组件模型渲染到终端（通过 ANSI 转义码）。

```text
React 组件树
     │
     ▼
Ink 渲染引擎
     │  ANSI 转义码
     ▼
终端（Terminal）
```

这种方案的优势：

- 与 Web 开发体验一致（JSX、hooks、状态管理）
- 组件可复用、可测试
- 支持复杂的交互式 UI（键盘导航、滚动、动态更新）

---

## 核心组件

### 应用根组件

| 组件          | 文件              | 说明                             |
| ------------- | ----------------- | -------------------------------- |
| `App`         | `App.tsx`         | 根组件，持有全局状态，渲染主界面 |
| `AutoUpdater` | `AutoUpdater.tsx` | 检测并提示更新新版本             |

### 对话与输入

| 组件              | 文件                 | 说明                           |
| ----------------- | -------------------- | ------------------------------ |
| `BaseTextInput`   | `BaseTextInput.tsx`  | 基础文本输入框                 |
| `TextInput`       | `TextInput/`         | 完整输入框（历史、补全、多行） |
| `MessageSelector` | `MessageSelector.js` | 消息过滤 / 选择器（懒加载）    |
| `PromptInput`     | `PromptInput/`       | 主提示输入框，带斜杠命令提示   |

### 上下文与状态显示

| 组件                   | 文件                       | 说明                              |
| ---------------------- | -------------------------- | --------------------------------- |
| `ContextVisualization` | `ContextVisualization.tsx` | Token 用量可视化（进度条 + 分段） |
| `CompactSummary`       | `CompactSummary.tsx`       | 对话压缩后的摘要展示              |
| `CostSummary`          | `CostSummary/`             | API 费用摘要                      |
| `Spinner`              | `Spinner.js`               | 加载动画（多种模式）              |

### 桥接与远程

| 组件                     | 文件                         | 说明                              |
| ------------------------ | ---------------------------- | --------------------------------- |
| `BridgeDialog`           | `BridgeDialog.tsx`           | Bridge 模式下的连接状态 UI        |
| `CoordinatorAgentStatus` | `CoordinatorAgentStatus.tsx` | Coordinator 模式多 Agent 状态面板 |

### 鉴权与配置

| 组件                             | 文件                                 | 说明                       |
| -------------------------------- | ------------------------------------ | -------------------------- |
| `ConsoleOAuthFlow`               | `ConsoleOAuthFlow.tsx`               | 终端内 OAuth 鉴权流程 UI   |
| `AwsAuthStatusBox`               | `AwsAuthStatusBox.tsx`               | AWS 鉴权状态展示           |
| `AutoModeOptInDialog`            | `AutoModeOptInDialog.tsx`            | 自动模式开启确认弹窗       |
| `ChannelDowngradeDialog`         | `ChannelDowngradeDialog.tsx`         | 降级渠道确认对话框         |
| `ClaudeMdExternalIncludesDialog` | `ClaudeMdExternalIncludesDialog.tsx` | CLAUDE.md 外部引用审批弹窗 |

### 工具输出展示

各工具有对应的进度 / 结果展示组件，如：

| 工具          | 展示组件                               |
| ------------- | -------------------------------------- |
| BashTool      | `BashProgress`（实时输出流）           |
| AgentTool     | `AgentToolProgress`（子 Agent 状态树） |
| WebSearchTool | `WebSearchProgress`（搜索结果卡片）    |
| SkillTool     | `SkillToolProgress`（技能执行步骤）    |

---

## Hooks（`src/hooks/`，60+ 个）

React Hooks 封装了状态逻辑，供组件复用。

### 关键 Hooks

| Hook                | 文件                    | 说明                              |
| ------------------- | ----------------------- | --------------------------------- |
| `useCanUseTool`     | `useCanUseTool.ts`      | 工具权限检查，返回 `CanUseToolFn` |
| `useAppState`       | `useAppState.ts`        | 订阅全局 AppState                 |
| `useQuery`          | `useQuery.ts`           | 触发 QueryEngine 查询             |
| `useKeypress`       | `useKeypress.ts`        | 键盘事件监听                      |
| `useTheme`          | `useTheme.ts`           | 主题颜色访问                      |
| `useCompact`        | `useCompact.ts`         | 触发手动压缩                      |
| `useClaudeAiLimits` | `claudeAiLimitsHook.ts` | 用量限制状态                      |

---

## Vim 模式（`src/vim/`）

输入框支持 Vim 键位模式：

- 通过 `:set` 或配置文件启用
- 支持 Normal / Insert / Visual 模式切换
- 实现 `h/j/k/l` 移动、`w/b` 单词跳转、`d/y/p` 操作等
- 与 `TextInput` 组件深度集成

---

## 语音输入（`src/voice/`）

实验性语音输入支持：

- `voice.ts` — 语音模式控制逻辑
- `voiceStreamSTT.ts` — 实时流式语音转文字（STT）
- `voiceKeyterms.ts` — 语音关键词识别（唤醒词等）

---

## 主题系统（`src/utils/theme.ts`）

Claude Code 支持多种颜色主题：

- 预置主题：`dark`、`light`、`system`（跟随终端背景）
- 自定义主题：通过 `/color` 命令或配置文件设置
- 所有颜色通过 `resolveThemeSetting()` 统一解析
- 组件通过 `useTheme()` hook 获取当前主题颜色

---

## 屏幕与对话框（`src/screens/`）

独立的全屏或弹窗界面，用于复杂的多步交互：

- 初始化向导（首次运行）
- 设置配置页
- MCP 服务器管理页
- Hooks 配置页

---

## ANSI 输出工具（`src/utils/`）

| 工具          | 文件           | 说明                                   |
| ------------- | -------------- | -------------------------------------- |
| Markdown 渲染 | `markdown.ts`  | 将 Markdown 转为带 ANSI 颜色的终端文本 |
| ANSI → PNG    | `ansiToPng.ts` | 将终端输出截图为 PNG（用于分享）       |
| ANSI → SVG    | `ansiToSvg.ts` | 将终端输出转为 SVG 矢量图              |

---

## 性能优化

Claude Code 的 UI 层做了多项性能优化：

- **懒加载**：`MessageSelector` 等重型组件使用 `require()` 延迟加载
- **startupProfiler**：记录启动各阶段耗时，用于性能回归检测
- **headlessProfiler**：无 UI 模式下的性能基准测试
- **并行预加载**：keychain、MDM 配置、MCP 连接在启动时并行初始化
