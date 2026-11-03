# BXT — Better Xterminal

[English](README.md) · **简体中文**

**模型是副驾，你是机长。**
BXT 把精准的终端上下文交给 AI，然后停下 —— 绝不替你按回车。

---

## 为什么做 BXT

终端正在卷入一场军备竞赛：Agent 会写代码、跑代码、读报错、再试一次，全程没有人。演示效果确实好。代价是 —— 一次幻觉，就离 `git push --force`、`docker system prune`、抑或对错误路径的 `rm -rf` 只差一个回车。

BXT 押的是相反的一边。不是因为自动化做不到，而是因为**"要不要执行"这个决定，属于拥有这台机器的人。**

所以它只做模型真正擅长的那部分 —— 把上下文拼准确 —— 剩下的交还给你：

- 记录终端里真实发生的事：命令、真实输出、是否被截断
- 只发送你勾选的那几轮，别的一概不发
- 当答案里带命令时，它把命令**打到你的提示符前** —— bracketed paste，不带换行，不自动提交
- 然后它就等着，光标一闪一闪

你读它、改它、决定它。按回车，或者起身走开。

这就是整个产品的立论：**上下文可以自动化，责任不能。**

## 由此推出的四条规则

1. **只填入，不执行。** 没有 shell 钩子，没有任何会替你写 `\r` 的内部通道。命令被执行只有一种可能：你自己按了回车。
2. **上下文要你选。** BXT 从不把整个屏幕缓冲区甩给模型。你勾特定的几轮，面板上会显示选了几轮。
3. **一轮就是单位。** 一条命令加它的输出，按标签页隔离。这正是上下文有用的原因 —— 靠猜你报错内容的聊天框，永远比不上真实的堆栈。
4. **中间没有第三方。** 请求从你的机器直接发到你配置的端点。没有 BXT 的服务器，没有代理，没有遥测。

## BXT 不是什么

- **不是 Agent** —— 没有循环、没有工具调用、没有自主性。
- **不是云服务** —— 没有需要你信任的后端。
- **不是 shell 的包装** —— 它本身就是 shell（ConPTY），PowerShell 的行为一点没变。

---

## ⚠️ 隐私边界（先看这个）

> **1. 终端内容会离开这台机器。**
> 你在 AI 面板里勾选的轮次会**原样**发给你配置的端点（DeepSeek / OpenAI / 任意 OpenAI 兼容服务）。BXT **不做脱敏**，中间也**没有我们的服务器** —— 请求从你的机器直接发往你填的 `baseUrl`。
> 请自行判断：不要把 `env`、`kubectl get secret -o yaml`、或任何带 token 的输出勾进上下文。
>
> **2. API Key 落盘前用 Windows DPAPI 加密。**
> 位置：`%APPDATA%\com.xustor.aiterminal.v1\ai-config.json`，值是 `dpapi:<base64>` 密文，作用域是*当前 Windows 用户 + 本机*。把文件拷到别的电脑或别的账户就解不开。Key 不会上传，也不会回传给前端。
>
> **3. 没有遥测。**
> 没有崩溃上报、没有使用统计、没有更新检查。

---

## 功能

- **原生终端** —— Rust + ConPTY；转义序列、进度条、表格对齐都和 Windows Terminal 一致
- **轮次上下文** —— 命令和输出自动成轮；勾选任意几轮作为上下文，按标签页隔离
- **超长输出只留尾巴** —— 单轮超过 400 行会截断并标记 `truncated`，一份刷屏的构建日志吃不掉整个窗口
- **多标签** —— 每个标签独立 PTY、独立轮次历史
- **命令面板** —— 双击 `Ctrl` 或 `Ctrl+Shift+P`；按真实使用频次排序，滚轮逐项遍历
- **右键即取** —— 有选中就复制，没选中就粘贴
- **主题** —— 强调色、终端底色、字号，带实时预览
- **一只幽灵** —— 关于页里能拖着玩的小彩蛋

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

从 [Releases](https://github.com/XUSTOR/bxt/releases) 下载 `BXT_x.y.z_x64-setup.exe`，双击安装 —— **无需管理员权限**，装进 `%LOCALAPPDATA%\Programs\BXT`，不触发 UAC。

**系统要求**：Windows 10 1809+ / Windows 11（WebView2 运行时系统自带）。

**首次运行**可能看到「Windows 已保护你的电脑」或「打开这些文件可能会对你的计算机有害」—— 这是未签名程序的例行提示，点「更多信息 → 仍要运行」或「确定」即可。

### 安装失败怎么办

| 现象 | 处理 |
|---|---|
| 报 `Error writing temporary file` | 安全软件（火绒 / 360 等）拦截了解压。**右键安装程序 → 以管理员身份运行** |
| 双击没反应 / 装到一半退出 | 先关闭安全软件的防护，或把安装包加入信任区，再重试 |
| 启动报 `msedgewebview2.exe` 应用程序错误 | 修复 WebView2 运行时：设置 → 应用 → Microsoft Edge WebView2 Runtime → 修改 → 修复 |

> ⚠️ **只有安装程序可以右键"以管理员身份运行"。**
> 请勿以管理员身份运行 BXT 本体 —— 提权与非提权混用会损坏 WebView2 的用户数据目录，之后普通权限就打不开了。

### 多个窗口

BXT 是单实例的：再次启动会把已有窗口提到前台。
（WebView2 的用户数据目录同一时刻只能被一个进程占用，双开会直接崩溃。）

## 从源码构建

```bash
# Node 20+、Rust 1.90+、Visual Studio Build Tools（C++ 桌面开发）
npm install
npx tauri dev        # 开发，热更新
npx tauri build      # 安装包在 src-tauri/target/release/bundle/nsis/
```

`npm` / `npx` 命令在仓库根目录执行；`cargo` 命令在 `src-tauri/` 下执行。

想额外要一个免安装的便携 zip（自用或排障很方便）：

```bash
powershell -ExecutionPolicy Bypass -File scripts\pack-portable.ps1
# 产物：dist-portable/BXT_x.y.z_portable.zip
```

## 项目结构

```
src/
  App.tsx                 标签页 / 快捷键 / 布局
  TerminalComponent.tsx   xterm 生命周期、PTY 桥接、轮次采集
  components/
    AiPanel.tsx           AI 面板外壳（只做组合）
    ai/                   useAiChat 状态机、上下文选择、消息列表、prompt 纯函数
    CommandPalette.tsx    命令面板
    SettingsModal.tsx     设置（外观 / API / 关于）
    PrivacyNotice.tsx     首次启动的隐私说明
    Markdown.tsx          手写 Markdown（带"插入终端"按钮）
    GhostPet.tsx          幽灵彩蛋
  lib/                    AI 客户端、轮次切片（含单测）、设置、平台判定
src-tauri/
  src/lib.rs              PTY 命令、启动失败弹窗、单实例守卫
  src/ai.rs               AI 配置与 SSE 流式代理（含单测）
  src/secret.rs           API Key 的 DPAPI 加解密
scripts/pack-portable.ps1 便携版打包
```

## 测试

```bash
npm test                              # 前端：轮次切片（vitest）
cd src-tauri && cargo test --lib      # 后端：SSE 解析（cargo test）
```

## 已知取舍

- **不做脱敏** —— 终端输出原样发出。这是刻意的产品决定，不是遗漏。
- **永不自动执行** —— 包括"方便起见"的开关。你要 Agent，这不是。
- **仅 Windows** —— PTY 走 ConPTY，密钥走 DPAPI。
- **单实例** —— 不支持多开窗口，WebView2 数据目录是独占的。
- **测试只覆盖纯函数** —— 轮次切片和 SSE 解析。UI 层没有自动化测试。

## 许可证

[MIT](LICENSE)

第三方：Tauri (MIT/Apache-2.0)、React (MIT)、xterm.js (MIT)、portable-pty (MIT)、reqwest (MIT/Apache-2.0)。
