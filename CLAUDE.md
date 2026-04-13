# Claude Code (源码提取版)

非官方 @anthropic-ai/claude-code v2.1.88 TypeScript 源码提取仓库。

## 文档索引

| 文件                                       | 职责                                                               |
| ------------------------------------------ | ------------------------------------------------------------------ |
| [doc/design.md](doc/design.md)             | 整体架构总览：数据流、模块地图、启动流程、运行模式、功能开关       |
| [doc/query-engine.md](doc/query-engine.md) | 核心对话循环引擎：QueryEngine 类、对话生命周期、压缩机制、权限模式 |
| [doc/tools.md](doc/tools.md)               | 工具系统：40+ 工具分类详解、任务系统、工具注册机制                 |
| [doc/commands.md](doc/commands.md)         | 命令系统：103+ 斜杠命令列表、命令 vs 工具对比                      |
| [doc/services.md](doc/services.md)         | 服务层：Claude API、MCP、OAuth、对话压缩、分析等服务               |
| [doc/bridge.md](doc/bridge.md)             | 桥接与远程模式：Bridge 协议、Coordinator 多 Agent、KAIROS 助手     |
| [doc/ui.md](doc/ui.md)                     | 终端 UI：React + Ink 组件、Hooks、Vim 模式、主题、语音输入         |

## Skills

源文件：`~/obsidian/skills/spq/`（相对 home，跨机器一致），通过 `.claude/skills/` 符号链接加载。

## Obsidian 归档路径

`OBS_DIR=~/obsidian/project/claude-code`
`PROJ_ROOT=/Users/sktlab/code/spq/claude-code`
