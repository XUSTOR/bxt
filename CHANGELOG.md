# Changelog

All notable changes to BXT are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

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
