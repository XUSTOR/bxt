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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}