# BXT — Better Xterminal

**English** · [简体中文](README.zh-CN.md)

**The model is the co-pilot. You are the pilot.**
BXT hands the AI exact terminal context and then stops — it never presses Enter for you.

[What changed in each version →](CHANGELOG.md)

---

## Why BXT

The terminal is in the middle of an arms race. Agents now write code, run it, read the failure, and try again, all without a human in the loop. It demos beautifully. It also means one hallucination sits a single keystroke away from `git push --force`, `docker system prune`, or `rm -rf` on the wrong path.

BXT takes the opposite bet. Not because automation is impossible, but because **the decision to run something belongs to the person who owns the machine.**

So it does the part models are actually good at — assembling precise context — and leaves the part that requires judgement to you:

- It records what really happened in your shell: the command, its real output, whether it was truncated.
- It sends only the rounds you tick, nothing else.
- When the answer contains a command, it **types it at your prompt** — bracketed paste, no trailing newline, no auto-submit.
- Then it waits, with the cursor blinking.

You read it. You edit it. You decide. Press Enter, or walk away.

That's the whole product thesis: **context can be automated; accountability can't.**

## The four rules that follow

1. **Insert, never execute.** No shell hook, no IPC path that writes `\r` for you. The only way a command runs is your own keystroke.
2. **Context is opt-in.** BXT never ships your whole buffer to a model. You tick specific rounds; the panel shows exactly how many are selected.
3. **A round is the unit.** One command plus its output, isolated per tab. This is what makes the context useful — a chat box guessing at your error message cannot beat the actual stack trace.
4. **No middleman.** Requests go from your machine straight to the endpoint you configured. There is no BXT server, no proxy, no telemetry.

## What BXT is not

- Not an agent — it has no loop, no tool calls, no autonomy.
- Not a cloud service — there is no backend to trust.
- Not a wrapper around your shell — it *is* the shell (ConPTY), so nothing changes about how PowerShell behaves.

---

## ⚠️ Privacy first

> **1. Your terminal content leaves this machine.**
> The rounds you tick in the AI panel are sent **verbatim** to the endpoint you configured (DeepSeek / OpenAI / any OpenAI-compatible service). BXT does **no redaction**, and there is **no server of ours** in the middle — requests go straight from your machine to your `baseUrl`.
> Use judgement: don't tick output from `env`, `kubectl get secret -o yaml`, or anything carrying tokens.
>
> **2. The API key is encrypted with Windows DPAPI before it touches disk.**
> Location: `%APPDATA%\com.xustor.aiterminal.v1\ai-config.json`; the value is `dpapi:<base64>` ciphertext scoped to *the current Windows user on this machine*. Copy the file to another PC or account and it becomes undecryptable. The key is never uploaded and never returned to the frontend.
>
> **3. No telemetry.**
> No crash reporting, no usage analytics, no update pings.

---

## Features

- **Native terminal** — Rust + ConPTY; escape sequences, progress bars and table alignment behave exactly as in Windows Terminal
- **Round-based context** — commands and their output become rounds; tick any of them as context, isolated per tab
- **Tail-trimmed context** — a round longer than 400 lines is cut to its end and flagged `truncated` before it reaches the model, so one runaway build log can't eat the whole window
- **Multiple tabs** — each with its own PTY and its own round history
- **Command palette** — double-tap `Ctrl` or `Ctrl+Shift+P`; ranked by real usage, mouse wheel steps through items
- **Right click** — copies when there's a selection, pastes when there isn't
- **Theming** — accent colour, terminal background, font size, with a live preview
- **A ghost** — a draggable easter egg on the About page

## Keybindings

| Keys | Action |
|---|---|
| Double `Ctrl` / `Ctrl+Shift+P` | Command palette |
| `Ctrl+Shift+A` | AI panel |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Switch tab |
| `Ctrl+Shift+C` | Copy |
| Right click | Copy if selection, otherwise paste |

`Ctrl+C` / `Ctrl+D` / `Ctrl+Z` / `Ctrl+L` / `Ctrl+R` / `Ctrl+A` / `Ctrl+U` / `Ctrl+W` keep their original terminal behaviour.

## Install

Download `BXT_x.y.z_x64-setup.exe` from [Releases](https://github.com/XUSTOR/bxt/releases) and double-click — **no administrator rights needed**. It installs per-user into `%LOCALAPPDATA%\BXT` and does not trigger UAC.

**Requirements**: Windows 10 1809+ / Windows 11 (WebView2 ships with the OS).

**On first launch** Windows may show "Windows protected your PC" or "Opening these files might be harmful" — the standard prompt for an unsigned binary. Click **More info → Run anyway**.

### If installation fails

| Symptom | What to do |
|---|---|
| `Error writing temporary file` | A security suite (Huorong / 360 etc.) blocked extraction. **Right-click the installer → Run as administrator** |
| Nothing happens / wizard exits halfway | Disable the security suite temporarily, or trust the installer, then retry |
| `msedgewebview2.exe` application error at startup | Repair the WebView2 runtime: Settings → Apps → Microsoft Edge WebView2 Runtime → Modify → Repair |

> These prompts all stem from one thing: **the installer is not code-signed**, so security software treats it as untrusted. The workarounds above are reliable, but the only real fix is signing the release — a known limitation of this version.

> ⚠️ **Only the installer may be run as administrator.**
> Never run BXT itself as administrator — mixing elevated and non-elevated runs corrupts the WebView2 user data directory, and the app will then refuse to start under a normal account.

### Multiple windows

BXT is single-instance: launching it again focuses the existing window.
(The WebView2 user data directory can only be held by one process at a time; a second instance would crash.)

## Build from source

```bash
# Node 20+, Rust 1.90+, Visual Studio Build Tools (Desktop development with C++)
npm install
npx tauri dev        # development, hot reload
npx tauri build      # installer lands in src-tauri/target/release/bundle/nsis/
```

Run `npm` / `npx` from the repository root; run `cargo` inside `src-tauri/`.

Want a no-install portable zip as well (handy for yourself or for debugging)?

```bash
powershell -ExecutionPolicy Bypass -File scripts\pack-portable.ps1
# output: dist-portable/BXT_x.y.z_portable.zip
```

## Project layout

```
src/
  App.tsx                 tabs / shortcuts / layout
  TerminalComponent.tsx   xterm lifecycle, PTY bridge, round capture
  components/
    AiPanel.tsx           AI panel shell (composition only)
    ai/                   useAiChat state machine, context picker, message list, prompt helpers
    CommandPalette.tsx    command palette
    SettingsModal.tsx     settings (appearance / API / about)
    PrivacyNotice.tsx     first-run privacy notice
    Markdown.tsx          hand-rolled Markdown (with "insert" buttons)
    GhostPet.tsx          the ghost easter egg
  lib/                    AI client, round slicing (unit tested), settings, platform check
src-tauri/
  src/lib.rs              PTY commands, startup failure dialog, single-instance guard
  src/ai.rs               AI config + SSE streaming proxy (unit tested)
  src/secret.rs           DPAPI encrypt/decrypt for the API key
scripts/pack-portable.ps1 portable build
```

## Tests

```bash
npm test                              # frontend: round slicing (vitest)
cd src-tauri && cargo test --lib      # backend: SSE parsing (cargo test)
```

## Known trade-offs

- **No redaction** — terminal output is sent as-is. A deliberate product decision, not an oversight.
- **No auto-execution, ever** — including "convenience" toggles. If you want an agent, this isn't it.
- **Windows only** — the PTY goes through ConPTY and secrets through DPAPI.
- **Single instance** — multi-window is not supported; the WebView2 data directory is exclusive.
- **Tests cover pure functions only** — round slicing and SSE parsing. No UI automation.

## License

[MIT](LICENSE)

Third-party: Tauri (MIT/Apache-2.0), React (MIT), xterm.js (MIT), portable-pty (MIT), reqwest (MIT/Apache-2.0).
