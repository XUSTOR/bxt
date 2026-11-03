# Changelog

English | [简体中文](CHANGELOG.zh-CN.md)

All notable changes to BXT are documented here. The Chinese translation is kept in sync in `CHANGELOG.zh-CN.md`.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

## [0.1.2] - 2026-11-03

### Added

- **Customizable keyboard shortcuts.** Nine actions can be rebound from Settings → Shortcuts: recording a key is a click on the row, <kbd>Esc</kbd> cancels, <kbd>Backspace</kbd> unbinds. Conflicts are reported on the spot, and modifier-less keys are rejected so a bare letter can never swallow your typing. Command palette, AI panel and copy-selection keep their defaults; opening Settings, creating/closing/switching tabs and focusing the terminal start unbound. Only the difference from the defaults is stored, so future default changes still reach existing users.
- The release build now disables WebView2's built-in browser accelerators (<kbd>F5</kbd>, <kbd>Ctrl</kbd>+<kbd>R</kbd>, <kbd>Ctrl</kbd>+<kbd>F</kbd>, <kbd>Ctrl</kbd>+<kbd>P</kbd>, <kbd>Ctrl</kbd>+<kbd>U</kbd>, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>) — pressing them inside a terminal should not reload or search the window. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> still reloads the interface.
- The AI panel is resizable: drag its left edge, double-click the handle to reset. The width is remembered across launches, and the terminal refits automatically.
- Small easter egg in About: double-click the ghost.

### Changed

- **The window background is correct from the very first frame.** Your chosen colour is persisted to `ui-prefs.json` and applied before the window is shown, instead of being patched in after it appeared — no more flash of the default dark colour on every launch. The page body starts transparent so the window colour is the only fallback and the two can no longer disagree.
- Dragging the colour picker samples at 60 Hz instead of at the mouse's own rate, and the write to disk is debounced by 300 ms, so dragging no longer re-renders every frame or rewrites the config file continuously.
- A corrupted WebView2 profile now heals itself: it is renamed and the app relaunches once, instead of stopping on an error dialog that asks you to find a directory by hand.
- The crash log falls back to the executable's folder when `%TEMP%` is not writable, and the dialog only names a path that actually exists.

### Fixed

- **Drag-selecting text no longer snaps back to the prompt.** The "scroll to bottom and focus" action fired on any mouse-down, so the terminal jumped to the cursor the instant you started selecting. It now only fires when the click really landed on empty space: no drag of more than 3 px, nothing selected, and the cell under the pointer genuinely blank.
- Focus returns to the terminal after inserting a command from the command palette, the AI panel, or a code block. Previously the focus stayed on the palette's input and dropped to the document when the palette closed, so you had to click the terminal again.
- The README said the installer places files in `%LOCALAPPDATA%\Programs\BXT`; the actual location is `%LOCALAPPDATA%\BXT`.

### For developers

- Debug builds use their own WebView2 data directory and skip the single-instance guard, so BXT can run BXT's own `tauri dev` while the installed copy stays open.
- Vite is pinned to port 5173 with `strictPort`; previously it could silently move to 5174 while `devUrl` still pointed at 5173, which loaded a stale dev server.

## [0.1.1] - 2026-11-03

### Fixed

- **Garbled non-ASCII output in the terminal.** The PTY reader cut each chunk at the wrong offset, so a multi-byte character split across a read boundary was emitted as `U+FFFD` — e.g. `本地连接` rendered as `��地连接`. Chunks are now cut at `valid_up_to()` and the partial tail is carried into the next read. Covered by four regression tests.

### Added

- First launch follows the system language: a Chinese Windows opens in Chinese. The language can also be switched from the top-right corner of the first-run notice, and from Settings → Appearance → Language.
- Chinese README (`README.zh-CN.md`) with a language switcher at the top of both files.

### Changed

- **Startup**: the window now paints the dark background immediately instead of flashing white; Settings and the command palette are code-split and loaded on demand.
- **Release build**: LTO + `opt-level="s"` + `strip`. `app.exe` went from 10.85 MB to 3.83 MB, the installer from 2.57 MB to 1.51 MB.
- The About page reads its version from the bundle instead of a hard-coded string.

### Removed

- Unused dependency `@xterm/addon-web-links`.

## [0.1.0] - 2026-11-03

First public release.

### Added

- Native terminal (Rust + ConPTY) with multiple tabs, each with its own PTY and round history
- Round-based context: tick the rounds you want the model to see, isolated per tab
- Answers are inserted at the prompt via bracketed paste, never executed
- Command palette, right-click copy/paste, themable UI (accent colour, background, font size)
- API key encrypted at rest with Windows DPAPI
- Single-instance guard; startup failures show a dialog instead of exiting silently
