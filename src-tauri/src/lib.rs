use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State, Manager};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;

mod ai;
mod secret;

struct PtyHandles {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

struct PtyState(Mutex<HashMap<String, PtyHandles>>);

// 👇 事件传输结构体
#[derive(Clone, Serialize)]
struct PtyOutputPayload {
    id: String,
    data: String,
}

/// 从 carry 头部切出可以安全解码的完整 UTF-8 前缀。
///
/// 关键点：**绝不能把不完整的多字节字符送出去**。
/// ConPTY 一次 read 可能正好停在汉字（3 字节）中间，那半截必须留在 carry 里
/// 等下一块拼齐，否则前端会看到 `��`（U+FFFD 替换符）。
#[cfg_attr(test, allow(dead_code))]
fn take_utf8_prefix(carry: &mut Vec<u8>) -> Option<String> {
    match std::str::from_utf8(carry) {
        Ok(_) => {
            if carry.is_empty() {
                return None;
            }
            let text = String::from_utf8_lossy(carry).to_string();
            carry.clear();
            Some(text)
        }
        Err(e) => {
            let valid = e.valid_up_to();
            if valid > 0 {
                // 只送合法前缀，尾巴留给下一块
                let text = String::from_utf8_lossy(&carry[..valid]).to_string();
                carry.drain(..valid);
                Some(text)
            } else if let Some(bad) = e.error_len() {
                // 开头就是真正的非法字节（不是被截断的前缀）：
                // 丢掉它，否则 carry 会永远卡在第一个字节上
                carry.drain(..bad);
                None
            } else {
                // 只读到半个字符，等下一块
                None
            }
        }
    }
}

/// 把一段已解码的文本发给前端（空串不发，省一次 IPC）
fn emit_output(app: &AppHandle, id: &str, text: String) {
    if text.is_empty() {
        return;
    }
    let _ = app.emit(
        "pty-output",
        PtyOutputPayload {
            id: id.to_string(),
            data: text,
        },
    );
}

#[tauri::command]
fn pty_start(
    app: AppHandle,
    state: State<'_, PtyState>,
    id: String,
    no_banner: Option<bool>,
) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    if map.contains_key(&id) {
        return Ok(()); 
    }

    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows: 24, cols: 80, pixel_width: 0, pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let mut cmd =
        CommandBuilder::new("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    // -NoLogo：跳过 "Windows PowerShell / 版权所有 / 安装最新版" 那段启动横幅
    if no_banner.unwrap_or(false) {
        cmd.arg("-NoLogo");
    }
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let thread_id = id.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        // 未被解码的尾巴。ConPTY 吐的是 UTF-8，一次 read 很可能把某个
        // 汉字（3 字节）从中间切断，半截必须留到下一块再拼。
        let mut carry: Vec<u8> = Vec::new();

        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    carry.extend_from_slice(&buf[..n]);
                    if let Some(text) = take_utf8_prefix(&mut carry) {
                        emit_output(&app_handle, &thread_id, text);
                    }
                }
                _ => break,
            }
        }
        let _ = child.kill();
    });

    map.insert(id, PtyHandles { writer, master: pair.master });
    Ok(())
}

#[tauri::command]
fn pty_write(state: State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(handles) = map.get_mut(&id) {
        handles.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        handles.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_resize(state: State<'_, PtyState>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(handles) = map.get_mut(&id) {
        handles.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_kill(state: State<'_, PtyState>, id: String) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    map.remove(&id); // Drop 会自动清理，前端监听也会停止
    Ok(())
}

/// 读系统剪贴板纯文本（右键粘贴用）。
/// 前端拿不到 clipboard-read 权限，走 Rust 侧最稳。
#[tauri::command]
fn clipboard_read_text() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

/// release 版没有控制台，panic 的信息用户完全看不到（表现就是"闪一下就没了"）。
/// 这里把启动错误写进日志并弹窗，避免无声退出。
#[cfg(windows)]
fn report_fatal(message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    let caption: Vec<u16> = "BXT".encode_utf16().chain(std::iter::once(0)).collect();
    let text: Vec<u16> = message.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            caption.as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(not(windows))]
fn report_fatal(message: &str) {
    eprintln!("{message}");
}

/// 把已知的启动失败翻译成用户能照着做的步骤。
fn friendly_panic(detail: &str) -> String {
    // 0x800700AA = ERROR_BUSY：WebView2 数据目录异常/被占用。
    // 最常见的原因是提权运行过、或被强杀后 profile 进入 WebView2 不认的状态。
    if is_busy_error(detail) {
        "BXT 无法启动：WebView2 数据目录异常。\n\n\
请依次尝试：\n\
1) 关闭所有 BXT 窗口，并在任务管理器里结束所有 msedgewebview2.exe\n\
2) 若仍失败，关闭程序后把下面这个目录改名（下次启动会自动重建）：\n\
   %LOCALAPPDATA%\\com.xustor.aiterminal.v1\\EBWebView\n\
3) 不要以管理员身份运行 —— 提权与非提权混用会损坏该目录\n\n\
注意：改名会重置主题、语言等界面偏好（API Key 不受影响）。"
            .to_string()
    } else {
        format!("BXT 崩溃：\n\n{detail}")
    }
}

fn is_busy_error(detail: &str) -> bool {
    detail.contains("0x800700AA") || detail.contains("ERROR_BUSY")
}

/// WebView2 的用户数据目录（与 tauri.conf.json 的 identifier 对应）。
/// 注意：改动 identifier 时这里也要同步改。
fn webview_profile_dir() -> Option<std::path::PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    Some(
        std::path::PathBuf::from(local)
            .join("com.xustor.aiterminal.v1")
            .join("EBWebView"),
    )
}

/// 遇到 ERROR_BUSY 时自愈：把坏掉的 profile 改名，然后重新拉起自己。
///
/// 用环境变量 BXT_HEALED 保证只自愈一次 —— 否则会无限重启。
/// 返回值表示"已经处理，不需要再弹窗"。
fn try_self_heal(detail: &str) -> bool {
    if !is_busy_error(detail) {
        return false;
    }
    if std::env::var_os("BXT_HEALED").is_some() {
        return false; // 已经重试过一次，这次老实弹窗
    }
    let Some(profile) = webview_profile_dir() else {
        return false;
    };
    if !profile.exists() {
        return false;
    }

    // 改名而不是删除：万一用户想捞回主题/偏好，还有一份在
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let broken = profile.with_file_name(format!("EBWebView.broken-{stamp}"));

    // 先清掉更早的备份，避免每坏一次就多几十 MB
    if let Some(parent) = profile.parent() {
        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if name.to_string_lossy().starts_with("EBWebView.broken-") {
                    let _ = std::fs::remove_dir_all(entry.path());
                }
            }
        }
    }

    if std::fs::rename(&profile, &broken).is_err() {
        return false;
    }

    // 重新拉起自己，带上"已经自愈过"的标记
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    if std::process::Command::new(exe)
        .env("BXT_HEALED", "1")
        .spawn()
        .is_err()
    {
        return false;
    }
    log::warn!("WebView2 profile 已重置为 {:?}，正在重启", broken);
    true
}

/// release 版没有控制台，启动阶段的 panic 完全不可见（表现就是"闪一下就没了"）。
/// 这里接住所有 panic：能自愈的先自愈，否则写日志 + 弹窗。
fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let detail = info.to_string();

        // 常见的 ERROR_BUSY 直接自愈重启，用户无感
        if try_self_heal(&detail) {
            std::process::exit(0);
        }

        let log_path = std::env::temp_dir().join("bxt-crash.log");
        let _ = std::fs::write(&log_path, format!("{detail}\n\n{info:?}\n"));
        report_fatal(&format!(
            "{}\n\n详细信息已写入：\n{}",
            friendly_panic(&detail),
            log_path.display()
        ));
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_hook();

    let result = tauri::Builder::default()
        // 必须最先注册：WebView2 的 profile 是单实例独占的，
        // 第二个进程去建 webview 会直接失败（ERROR_BUSY / 浏览器进程崩溃）。
        // 这里把"第二次启动"变成"聚焦已有窗口"。
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            app.manage(PtyState(Mutex::new(HashMap::new())));
            app.manage(ai::AiState::load(app.handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_start,
            pty_write,
            pty_resize,
            pty_kill,
            clipboard_read_text,
            ai::ai_get_config,
            ai::ai_set_config,
            ai::ai_chat,
            ai::ai_cancel,
            ai::ai_test
        ])
        .run(tauri::generate_context!());

    if let Err(err) = result {
        // 日志放在 %TEMP%，那里一定可写；弹窗里给用户路径
        let log_path = std::env::temp_dir().join("bxt-startup-error.log");
        let _ = std::fs::write(
            &log_path,
            format!("BXT 启动失败\n\n{err}\n\n{err:?}\n"),
        );
        report_fatal(&format!(
            "BXT 启动失败：\n\n{err}\n\n详细信息已写入：\n{}",
            log_path.display()
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::take_utf8_prefix;

    #[test]
    fn split_multibyte_char_is_not_emitted_halfway() {
        // 「本」= E6 9C AC。模拟一次 read 正好停在 2 字节处。
        let full = "本地连接".as_bytes().to_vec();
        let mut carry = full[..2].to_vec();

        // 半截字符不能产出任何东西 —— 产出就意味着前端会看到 `��`
        assert_eq!(take_utf8_prefix(&mut carry), None);

        // 剩下两字节到齐后，应当一次性解出完整字符串
        carry.extend_from_slice(&full[2..]);
        assert_eq!(take_utf8_prefix(&mut carry).as_deref(), Some("本地连接"));
        assert!(carry.is_empty());
    }

    #[test]
    fn complete_chunk_passes_through() {
        let mut carry = "PS C:\\> dir".as_bytes().to_vec();
        assert_eq!(
            take_utf8_prefix(&mut carry).as_deref(),
            Some("PS C:\\> dir")
        );
        assert!(carry.is_empty());
    }

    #[test]
    fn invalid_byte_is_dropped_without_stalling() {
        // 0xFF 不是合法的 UTF-8 起始字节：必须丢掉，否则 carry 永远卡住
        let mut carry = vec![0xFF, b'a'];
        assert_eq!(take_utf8_prefix(&mut carry), None);
        assert_eq!(take_utf8_prefix(&mut carry).as_deref(), Some("a"));
    }

    #[test]
    fn empty_carry_yields_nothing() {
        let mut carry = Vec::new();
        assert_eq!(take_utf8_prefix(&mut carry), None);
    }
}