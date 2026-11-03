//! 界面偏好里"必须在 WebView 起来之前就生效"的那部分。
//!
//! 背景色决定窗口 / WebView2 的初始底色：窗口创建的那一刻如果还不知道用户选了什么，
//! 启动瞬间闪的就是写死的默认色。而用户的选择存在 WebView 的 localStorage 里，
//! 那时候 WebView 还没起来 —— Rust 读不到。所以每次改色都往磁盘多写一份，
//! 供下一次启动在窗口露面之前贴上去。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::window::Color;
use tauri::{AppHandle, Manager, WebviewWindow};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct UiPrefs {
    /// 形如 `#1e1e2e`。没有这个文件（从没改过色）= 用 tauri.conf.json 里的默认值
    bg_color: Option<String>,
}

fn prefs_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位配置目录: {e}"))?;
    Ok(dir.join("ui-prefs.json"))
}

fn read_prefs(app: &AppHandle) -> UiPrefs {
    prefs_file(app)
        .ok()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write_prefs(app: &AppHandle, prefs: &UiPrefs) -> Result<(), String> {
    let path = prefs_file(app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("无法创建配置目录: {e}"))?;
    }
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("界面偏好写入失败: {e}"))
}

/// 只认 `#rgb` / `#rrggbb` / `#rrggbbaa`（`Color` 自己的解析规则）。
/// 这个值会进原生窗口属性，非法值直接拒掉，别让它一路传下去。
fn parse_bg(value: &str) -> Option<Color> {
    value.trim().parse::<Color>().ok()
}

/// 启动阶段调用：把上次记住的背景色贴到窗口和 WebView2 上。
/// 这个调用排在事件循环开跑之前，所以 WebView2 的首帧用的就是它。
pub fn apply_saved_bg(app: &AppHandle, window: &WebviewWindow) {
    let Some(color) = read_prefs(app).bg_color.as_deref().and_then(parse_bg) else {
        return;
    };
    if let Err(e) = window.set_background_color(Some(color)) {
        log::warn!("应用记忆的背景色失败: {e}");
    }
}

/// 前端改了背景色：落盘一份给下次启动用，同时更新当前窗口的底色
/// （窗口边缘露出来的那圈、以及缩放时的瞬时空白都是它）。
#[tauri::command]
pub fn ui_set_bg_color(app: AppHandle, color: String) -> Result<(), String> {
    let parsed = parse_bg(&color).ok_or_else(|| format!("背景色格式不支持: {color}"))?;

    let mut prefs = read_prefs(&app);
    if prefs.bg_color.as_deref() != Some(color.trim()) {
        prefs.bg_color = Some(color.trim().to_string());
        write_prefs(&app, &prefs)?;
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_background_color(Some(parsed));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::parse_bg;
    use tauri::window::Color;

    #[test]
    fn accepts_hex_colors() {
        assert_eq!(parse_bg("#1e1e2e"), Some(Color(30, 30, 46, 255)));
        assert_eq!(parse_bg("  #abc  "), Some(Color(170, 187, 204, 255)));
        // 带 alpha 的写法也收
        assert_eq!(parse_bg("#1e1e2e80"), Some(Color(30, 30, 46, 128)));
    }

    #[test]
    fn rejects_anything_else() {
        for bad in ["", "rgb(30,30,46)", "#12345", "#xyzxyz", "transparent"] {
            assert_eq!(parse_bg(bad), None, "{bad} 不该被接受");
        }
    }
}
