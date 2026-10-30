use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State, Manager};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};

struct PtyHandles {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

// 用 Option 包起来，实现懒加载
struct PtyState(Mutex<Option<PtyHandles>>);

#[tauri::command]
fn pty_start(app: AppHandle, state: State<'_, PtyState>) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if slot.is_some() {
        return Ok(()); // 如果已经启动，直接跳过
    }

    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
        rows: 24, cols: 80, pixel_width: 0, pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let cmd = CommandBuilder::new("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    // 必须释放 slave，否则读不到数据
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        let mut carry: Vec<u8> = Vec::new(); 

        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    carry.extend_from_slice(&buf[..n]);
                    // 安全切分 UTF-8，防止中文字符截断乱码
                    let cut = match std::str::from_utf8(&carry) {
                        Ok(_) => carry.len(),
                        Err(e) => carry.len() - e.error_len().unwrap_or(0),
                    };
                    
                    let text = String::from_utf8_lossy(&carry[..cut]).to_string();
                    carry.drain(..cut);

                    if !text.is_empty() {
                        let _ = app.emit("pty-output", text);
                    }
                }
                _ => break,
            }
        }
        let _ = child.kill();
    });

    *slot = Some(PtyHandles { writer, master: pair.master });
    Ok(())
}

#[tauri::command]
fn pty_write(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(handles) = slot.as_mut() {
        handles.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        handles.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_resize(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(handles) = slot.as_mut() {
        handles.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(PtyState(Mutex::new(None)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![pty_start, pty_write, pty_resize])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}