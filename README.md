# BXT — Better Xustor Terminal

一个把 AI 放进终端的 Windows 桌面工具：**命令轮次即上下文，答案只填入、不执行**。

基于 Tauri 2 + React 19 + xterm.js + Rust（ConPTY）构建，安装包约 5 MB，不需要 Node、不需要管理员权限。

---

## ⚠️ 隐私边界（先看这个）

> **1. 终端内容会离开你的电脑。**
> 你在 AI 面板里勾选的命令轮次会**原样**发给你自己配置的 AI 端点（DeepSeek / OpenAI / 任意 OpenAI 兼容服务）。本程序**不做脱敏**，也**没有任何自有服务器**做中转 —— 请求由本机直接发往你填写的 `baseUrl`。
> 因此请自行判断：不要把 `env`、`kubectl get secret -o yaml`、含 token 的命令输出勾进上下文。
>
> **2. API Key 用 Windows DPAPI 加密后落盘。**
> 位置：`%APPDATA%\com.xustor.aiterminal.v1\ai-config.json`，字段值是 `dpapi:<base64>` 密文，作用域是「当前 Windows 用户 + 本机」—— 把配置文件拷到别的电脑或别的账户都解不开。Key 不会上传，也不会回传到前端。
>
> **3. 没有遥测。**
> 没有崩溃上报、没有使用统计、没有自动更新检查。

---

## 特性

- **原生终端**：Rust + ConPTY，支持 PowerShell / pwsh，VT 序列、进度条、表格对齐都正常
- **轮次上下文**：每条命令 + 它的输出自动归为"一轮"，勾选任意几轮作为 AI 的上下文，按标签页隔离，不会串台
- **只填入不执行**：AI 给出的命令通过 bracketed paste 插入到提示符，**回车由你自己按**
- **多标签**：每个标签独立 PTY、独立轮次
- **命令面板**：双击 `Ctrl` 或 `Ctrl+Shift+P`，按使用频次排序的历史命令，滚轮逐项遍历
- **右键即取**：选中时复制，未选中时粘贴
- **可调外观**：强调色、终端底色、字号，实时预览
- **一只幽灵**：关于页里能拖来拖去的小彩蛋

## 快捷键

| 按键 | 作用 |
|---|---|
| 双击 `Ctrl` / `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+Shift+A` | AI 面板 |
| `Ctrl+T` | 新建标签 |
| `Ctrl+W` | 关闭标签 |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | 切换标签 |
| `Ctrl+Shift+C` | 复制 |
| 右键 | 有选中=复制，无选中=粘贴 |

`Ctrl+C` / `Ctrl+D` / `Ctrl+Z` / `Ctrl+L` / `Ctrl+R` / `Ctrl+A` / `Ctrl+U` / `Ctrl+W` 全部保持终端原始行为。

## 安装

从 [Releases](https://github.com/xustor/bxt/releases) 下载 `BXT_x.y.z_x64-setup.exe`，双击即可 —— **per-user 安装，不弹 UAC**，装进 `%LOCALAPPDATA%\Programs\BXT`。

不想装的话，`app.exe` 是自包含单文件，复制出来直接运行。

**系统要求**：Windows 10 1809+ / Windows 11（WebView2 系统自带）。

## 从源码构建

```bash
# 依赖：Node 20+、Rust 1.90+、Visual Studio Build Tools（C++ 桌面开发）
npm install
npx tauri dev        # 开发，热更新
npx tauri build      # 打包，产物在 src-tauri/target/release/bundle/nsis/
```

## 项目结构

```
src/
  App.tsx                 标签页 / 快捷键 / 布局
  TerminalComponent.tsx   xterm 生命周期、PTY 桥接、轮次采集
  components/
    AiPanel.tsx           AI 对话：流式输出、轮次勾选、插入终端
    CommandPalette.tsx    命令面板
    SettingsModal.tsx     设置（外观 / API / 关于）
    Markdown.tsx          手写 Markdown（带"插入终端"按钮）
    GhostPet.tsx          幽灵彩蛋
  lib/                    AI 客户端、设置、平台判定
src-tauri/
  src/lib.rs              PTY 命令（pty_start / write / resize / kill、剪贴板）
  src/ai.rs               AI 配置与 SSE 流式代理
  src/secret.rs           API Key 的 DPAPI 加解密
```

## 已知取舍

- **不做脱敏**：终端输出原样发出。这是刻意的产品决定，不是遗漏。
- **不做多平台**：PTY 走 ConPTY，API 走 DPAPI，都是 Windows 专有。
- **没有自动化测试**：目前只有 `tsc` + ESLint 作为闸门。

## 许可证

[MIT](LICENSE)

第三方：Tauri (MIT/Apache-2.0)、React (MIT)、xterm.js (MIT)、portable-pty (MIT)、reqwest (MIT/Apache-2.0)。
