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
        let mut carry: Vec<u8> = Vec::new(); 

        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    carry.extend_from_slice(&buf[..n]);
                    let cut = match std::str::from_utf8(&carry) {
                        Ok(_) => carry.len(),
                        Err(e) => carry.len() - e.error_len().unwrap_or(0),
                    };
                    
                    let text = String::from_utf8_lossy(&carry[..cut]).to_string();
                    carry.drain(..cut);

                    if !text.is_empty() {
                        let payload = PtyOutputPayload { id: thread_id.clone(), data: text };
                        let _ = app_handle.emit("pty-output", payload);
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
    // 最常见的原因是提权运行过，profile 里混进了非提权上下文写不动的文件。
    if detail.contains("0x800700AA") || detail.contains("ERROR_BUSY") {
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

/// release 版没有控制台，启动阶段的 panic 完全不可见（表现就是"闪一下就没了"）。
/// 这里接住所有 panic：写日志 + 弹窗，让失败永远有话说。
fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let detail = info.to_string();
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