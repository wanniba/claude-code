# 桥接与远程模式（Bridge）

对应源文件：`src/bridge/`（30 个文件）、`src/remote/`

---

## 概述

Bridge 模式允许 claude.ai 网页端**远程控制**本地终端中运行的 Claude Code，
实现"网页界面 + 本地执行能力"的混合体验。

```text
claude.ai 网页
     │  WebSocket / SSE
     ▼
Bridge 服务器（Anthropic 云）
     │  长连接轮询
     ▼
本地 Claude Code（Bridge 模式）
     │
     ▼
本地文件系统 / Shell / 工具
```

---

## 核心文件说明

### 连接管理

| 文件                     | 职责                                  |
| ------------------------ | ------------------------------------- |
| `bridgeMain.ts`          | Bridge 模式入口，初始化并启动连接     |
| `replBridge.ts`          | REPL 与 Bridge 的适配层               |
| `replBridgeHandle.ts`    | Bridge 会话句柄，管理单次连接生命周期 |
| `replBridgeTransport.ts` | 传输层抽象（支持 SSE / WebSocket）    |
| `remoteBridgeCore.ts`    | 远程桥接核心逻辑                      |

### 会话管理

| 文件                 | 职责                        |
| -------------------- | --------------------------- |
| `createSession.ts`   | 创建新的 Bridge 会话        |
| `sessionRunner.ts`   | 会话执行循环                |
| `sessionIdCompat.ts` | 会话 ID 兼容性处理          |
| `codeSessionApi.ts`  | Code Session API 客户端封装 |

### 配置与鉴权

| 文件                     | 职责                                  |
| ------------------------ | ------------------------------------- |
| `bridgeConfig.ts`        | Bridge 连接配置（服务器地址、超时等） |
| `envLessBridgeConfig.ts` | 无环境变量依赖的配置（可移植）        |
| `pollConfig.ts`          | 轮询配置（间隔、退避策略）            |
| `pollConfigDefaults.ts`  | 轮询默认参数                          |
| `jwtUtils.ts`            | JWT 令牌解析与验证                    |
| `trustedDevice.ts`       | 可信设备注册与校验                    |
| `workSecret.ts`          | 工作密钥管理（设备间安全通信）        |

### 消息处理

| 文件                    | 职责                         |
| ----------------------- | ---------------------------- |
| `inboundMessages.ts`    | 处理从云端下发的入站消息     |
| `inboundAttachments.ts` | 处理入站文件附件             |
| `bridgeMessaging.ts`    | 消息序列化 / 反序列化        |
| `bridgePointer.ts`      | 消息指针（断点续传）         |
| `flushGate.ts`          | 输出刷新门控（批量 vs 实时） |

### 权限与状态

| 文件                           | 职责                             |
| ------------------------------ | -------------------------------- |
| `bridgePermissionCallbacks.ts` | 远程权限确认回调（网页端弹窗）   |
| `bridgeEnabled.ts`             | 判断 Bridge 模式是否可用         |
| `bridgeStatusUtil.ts`          | Bridge 连接状态工具函数          |
| `bridgeApi.ts`                 | Bridge REST API 封装             |
| `bridgeUI.ts`                  | Bridge 模式专属 UI 组件适配      |
| `bridgeDebug.ts`               | 调试工具                         |
| `capacityWake.ts`              | 容量唤醒（资源不足时的恢复机制） |
| `debugUtils.ts`                | 调试辅助工具                     |
| `initReplBridge.ts`            | REPL Bridge 初始化序列           |

---

## Bridge 模式下的权限处理

普通模式下，权限确认弹窗直接在本地终端显示。
Bridge 模式下，权限请求通过网络发送到 claude.ai 网页端，用户在网页上确认后结果回传到本地。

```text
本地工具请求权限
     │
     ▼
bridgePermissionCallbacks.ts
     │  发送权限请求到云端
     ▼
claude.ai 网页端弹窗
     │  用户点击允许/拒绝
     ▼
回传 PermissionResult
     │
     ▼
本地继续 / 取消工具执行
```

---

## 断线重连机制

Bridge 使用**长轮询**（Long Polling）+ **指数退避**保证连接稳定性：

- `pollConfig.ts` 控制轮询间隔（默认 ~1s，断线后逐步增加到 ~30s）
- `bridgePointer.ts` 记录消息指针，断线重连后从上次位置续传
- `capacityWake.ts` 在服务器资源不足时进入等待，待容量恢复后自动唤醒

---

## Coordinator 模式（多 Agent 编排）

`src/coordinator/` 实现了**多 Agent Swarm** 能力（`COORDINATOR_MODE` 构建标志控制）：

- 一个 Coordinator Agent 负责任务分解和结果汇总
- 多个 Worker Agent 并行执行子任务
- Worker 之间通过 `SendMessageTool` 通信
- `coordinatorMode.ts` 提供协调者系统提示和上下文注入
- 每个 Worker 拥有独立的 QueryEngine 实例和权限上下文

---

## 助手模式（KAIROS，实验性）

`src/assistant/`（`KAIROS` 构建标志控制）实现主动式助手：

- 不等待用户输入，主动观察环境变化（文件、Git、终端输出）
- `sessionHistory.ts` 维护跨会话的主动式记忆
- 适用于长时间运行的后台监控任务
