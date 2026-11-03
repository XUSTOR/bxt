# BXT — Better Xterminal

[English](README.md) · **简体中文**

**模型是副驾，你是机长。**
BXT 把终端上下文准确地交给 AI，然后停手 —— 绝不替你按回车。

---

## 为什么做 BXT

现在做终端工具的，都在往自动化上卷：Agent 自己写代码、自己跑、读报错、再试一次，全程不需要人。演示很好看。

代价是：只要模型错一次，`git push --force`、`docker system prune`、或者对着错误路径的 `rm -rf`，就只差一个回车。

BXT 反过来。不是因为自动化做不了，而是「这条命令到底跑不跑」，该由机器的所有者说了算。

所以它只做模型真正擅长的那一半 —— 把上下文准备准确 —— 另一半留给你：

- 如实记下终端里发生了什么：命令、输出、有没有被截断
- 只发你勾选的那几轮，其余一个字都不发
- 答案里带命令时，把命令**填到提示符后面**：用 bracketed paste 包好，不换行、不提交
- 然后就等着，光标在那儿闪

你看、你改、你决定。回车你按，或者干脆不管它。

一句话：**上下文可以交给 AI，责任不行。**

## 四条规则

1. **只填，不跑。** 没有 shell 钩子，也没有任何地方会替你写 `\r`。一条命令要跑起来，只能是你按下去的那个回车。
2. **发什么，你说了算。** BXT 从不把整个屏幕缓冲区甩给模型。勾哪几轮就发哪几轮，面板上写着你勾了几条。
3. **一轮就是一个单位。** 一条命令加上它的输出，按标签页隔开。上下文之所以有用就在这儿：让模型猜你的报错，永远不如直接把真实堆栈给它。
4. **中间没有第三方。** 请求从你的机器直接发到你配的端点。没有我们的服务器，没有代理，没有遥测。

## BXT 不做什么

- **不是 Agent** —— 没有循环，不调工具，不会自己动
- **不是云服务** —— 没有需要你信任的后端
- **不是 shell 的壳子** —— 它本身就是终端（ConPTY），PowerShell 的行为一点没变

---

## ⚠️ 先看隐私

> **一、终端内容会离开这台机器。**
> 你在 AI 面板里勾的轮次，会原样发给你配的端点（DeepSeek / OpenAI / 任何 OpenAI 兼容服务）。BXT 不做脱敏，中间也没有我们的服务器 —— 请求从本机直接发往你填的 `baseUrl`。
> 所以自己把握：`env`、`kubectl get secret -o yaml`、带 token 的输出，别勾。
>
> **二、API Key 落盘前先用 Windows DPAPI 加密。**
> 位置在 `%APPDATA%\com.xustor.aiterminal.v1\ai-config.json`，值是 `dpapi:<base64>` 密文，作用域是「当前 Windows 用户 + 本机」。文件拷到别的电脑或别的账户都解不开。Key 不上传，也不回传前端。
>
> **三、没有遥测。**
> 不报崩溃、不统计使用、不检查更新。

---

## 功能

- **原生终端** —— Rust + ConPTY；转义序列、进度条、表格对齐都和 Windows Terminal 一致
- **按轮次取上下文** —— 命令和输出自动归成一轮，勾哪轮发哪轮，按标签页隔离
- **长输出只留尾巴** —— 一轮超过 400 行就只保留末尾并标上「已截断」，别让一次构建刷屏占满整段上下文
- **多标签** —— 每个标签独立 PTY、独立历史
- **命令面板** —— 双击 `Ctrl` 或 `Ctrl+Shift+P`，按实际使用次数排序，滚轮逐项翻
- **右键** —— 选中就复制，没选中就粘贴
- **主题** —— 强调色、终端底色、字号，改完立刻看到效果
- **有只幽灵** —— 关于页里能拖着玩的小彩蛋

## 快捷键

| 按键 | 作用 |
|---|---|
| 双击 `Ctrl` / `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+Shift+A` | AI 面板 |
| `Ctrl+T` | 新建标签 |
| `Ctrl+W` | 关闭标签 |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | 切换标签 |
| `Ctrl+Shift+C` | 复制 |
| 右键 | 有选中就复制，没选中就粘贴 |

`Ctrl+C` / `Ctrl+D` / `Ctrl+Z` / `Ctrl+L` / `Ctrl+R` / `Ctrl+A` / `Ctrl+U` / `Ctrl+W` 全部保留终端原本的行为。

## 安装

从 [Releases](https://github.com/XUSTOR/bxt/releases) 下载 `BXT_x.y.z_x64-setup.exe`，双击装就行 —— **不需要管理员权限**，装在 `%LOCALAPPDATA%\BXT`，不会弹 UAC。

**系统要求**：Windows 10 1809+ / Windows 11（WebView2 运行时系统自带）。

**第一次打开**可能看到「Windows 已保护你的电脑」或者「打开这些文件可能会对你的计算机有害」。这是未签名程序的例行提示，点「更多信息 → 仍要运行」或者「确定」就过去了。

### 装不上怎么办

| 现象 | 怎么办 |
|---|---|
| 报 `Error writing temporary file` | 安全软件（火绒 / 360 之类）拦了解压。**右键安装程序 → 以管理员身份运行** |
| 双击没反应，或者装到一半退出 | 先关掉安全软件的防护，或者把安装包加进信任区，再试一次 |
| 启动时报 `msedgewebview2.exe` 应用程序错误 | 修一下 WebView2 运行时：设置 → 应用 → Microsoft Edge WebView2 Runtime → 修改 → 修复 |

> 这些提示都来自同一个原因：**安装包没有代码签名**，安全软件会额外审查它。上面的办法都能绕过，但真正的根治是给发布物签名 —— 这是当前版本的已知限制。

> ⚠️ **只有安装程序可以右键「以管理员身份运行」。**
> BXT 本体别这么干 —— 提权和非提权混着跑会把 WebView2 的用户数据目录弄坏，之后普通权限就打不开了。

### 关于多开

BXT 是单实例的：再启动一次，是把已有的窗口提到前面，不会开第二个。
（WebView2 的用户数据目录同一时间只能被一个进程占着，真开两个会直接崩。）

## 从源码构建

```bash
# 依赖：Node 20+、Rust 1.90+、Visual Studio Build Tools（C++ 桌面开发）
npm install
npx tauri dev        # 开发，热更新
npx tauri build      # 打包，安装包在 src-tauri/target/release/bundle/nsis/
```

`npm` / `npx` 在仓库根目录跑；`cargo` 在 `src-tauri/` 下跑。

想要个免安装的便携 zip（自己用或者排障都方便）：

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
    AiPanel.tsx           AI 面板外壳（只负责拼装）
    ai/                   useAiChat 状态机、上下文选择、消息列表、prompt 纯函数
    CommandPalette.tsx    命令面板
    SettingsModal.tsx     设置（外观 / API / 关于）
    PrivacyNotice.tsx     首次启动的隐私说明
    Markdown.tsx          自己写的 Markdown（带「插入终端」按钮）
    GhostPet.tsx          幽灵彩蛋
  lib/                    AI 客户端、轮次切片（有单测）、设置、平台判定
src-tauri/
  src/lib.rs              PTY 命令、启动失败弹窗、单实例守卫
  src/ai.rs               AI 配置与 SSE 流式代理（有单测）
  src/secret.rs           API Key 的 DPAPI 加解密
scripts/pack-portable.ps1 便携版打包
```

## 测试

```bash
npm test                              # 前端：轮次切片（vitest）
cd src-tauri && cargo test --lib      # 后端：SSE 解析（cargo test）
```

## 已知取舍

- **不做脱敏** —— 终端输出原样发出。这是有意为之，不是漏了。
- **永不自动执行** —— 连「方便起见」的开关都不给。想要 Agent，这工具不适合。
- **只支持 Windows** —— PTY 走 ConPTY，密钥走 DPAPI。
- **单实例** —— 不支持多窗口，WebView2 的数据目录是独占的。
- **测试只覆盖纯函数** —— 轮次切片和 SSE 解析。UI 层没有自动化测试。

## 许可证

[MIT](LICENSE)

第三方：Tauri (MIT/Apache-2.0)、React (MIT)、xterm.js (MIT)、portable-pty (MIT)、reqwest (MIT/Apache-2.0)。
