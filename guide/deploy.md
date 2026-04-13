# cr7 部署指南

## 快速部署（一键）

```bash
bash scripts/deploy.sh
```

执行完成后直接运行 `cr7` 即可。

---

## 手动步骤说明

### 环境要求

| 依赖                  | 版本    | 说明           |
| --------------------- | ------- | -------------- |
| [Bun](https://bun.sh) | ≥ 1.3.0 | 构建运行时     |
| Node / npm            | ≥ 18    | 全局安装用     |
| macOS / Linux         | —       | Windows 未测试 |

安装 Bun：

```bash
curl -fsSL https://bun.sh/install | bash
```

### 步骤 1：安装依赖

```bash
AUTHORIZED=1 bun install
```

> `AUTHORIZED=1` 用于绕过 package.json 的 `prepare` 钩子防护，本项目本地构建专用。

### 步骤 2：构建

```bash
bun run build.ts
```

产物为根目录的 `cli.js`（~12 MB 单文件）。

### 步骤 3：全局安装

```bash
AUTHORIZED=1 npm install -g .
```

安装后 `/opt/homebrew/bin/cr7` 通过硬链接指向 `cli.js`，**重新构建后无需重新安装**，`cr7` 命令自动更新。

---

## 升级（拉新代码后）

```bash
git pull
bash scripts/deploy.sh
```

---

## 仅重新构建（不重新安装）

如果只改了源码，`cr7` 已经全局安装，只需：

```bash
bun run build.ts
```

因为 cli.js 是硬链接，构建完即生效，无需重新 `npm install -g`。

---

## 常见问题

**Q: `npm install -g .` 报 "Direct publishing is not allowed"**

用 `AUTHORIZED=1 npm install -g .` 替代。

**Q: `bun` 找不到**

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

加入 `~/.zshrc` 后重开终端。

**Q: `cr7` 命令不存在**

确认 `/opt/homebrew/bin` 在 `$PATH` 中：

```bash
echo $PATH | grep homebrew
```

如果不在，添加到 `~/.zshrc`：

```bash
export PATH="/opt/homebrew/bin:$PATH"
```
