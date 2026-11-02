//! AI 服务：OpenAI 兼容的 Chat Completions 代理。
//!
//! 设计要点：
//! - API Key 只在 Rust 侧保存，前端永远读不到原文，只能拿到 `has_key`。
//! - 落盘前用 Windows DPAPI 加密（见 `secret` 模块），磁盘上不留明文。
//! - 请求由后端发出，避免浏览器 CORS，也避免 key 暴露在 webview 里。
//! - 用流式（stream: true）+ 事件回传，前端订阅 `ai-delta` / `ai-done` / `ai-error`。

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::secret;

/// 保存在磁盘上的配置。`api_key` 存的是 `dpapi:<base64>` 密文，
/// 旧版本留下的明文会在 `AiState::load` 里被就地加密。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AiConfig {
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub api_key: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            base_url: "https://api.deepseek.com/v1".into(),
            model: "deepseek-chat".into(),
            temperature: 0.3,
            api_key: String::new(),
        }
    }
}

/// 给前端看的配置：不含 api_key 原文，只告诉它有没有
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigPublic {
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub has_key: bool,
}

impl From<&AiConfig> for AiConfigPublic {
    fn from(c: &AiConfig) -> Self {
        Self {
            base_url: c.base_url.clone(),
            model: c.model.clone(),
            temperature: c.temperature,
            has_key: !c.api_key.trim().is_empty(),
        }
    }
}

/// 前端保存配置时传的载荷
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigInput {
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    /// None = 不改动已有 key；Some("") = 清除 key
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub id: String,
    pub messages: Vec<AiMessage>,
}

#[derive(Clone, Serialize)]
struct AiDelta {
    id: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiDone {
    id: String,
    cancelled: bool,
}

#[derive(Clone, Serialize)]
struct AiError {
    id: String,
    message: String,
}

pub struct AiState {
    config: Mutex<AiConfig>,
    cancelled: Mutex<HashSet<String>>,
}

impl AiState {
    pub fn load(app: &AppHandle) -> Self {
        let mut config = read_config(app).unwrap_or_default();

        // 迁移：旧版把 key 明文存在 json 里，读到就地加密并重写一次
        if !config.api_key.trim().is_empty() && !secret::is_encrypted(&config.api_key) {
            match secret::protect(&config.api_key) {
                Ok(encrypted) => {
                    config.api_key = encrypted;
                    if let Err(e) = write_config(app, &config) {
                        log::warn!("API Key 已加密但写回配置失败: {e}");
                    }
                }
                Err(e) => log::warn!("API Key 加密失败，暂时保留明文: {e}"),
            }
        }

        Self {
            config: Mutex::new(config),
            cancelled: Mutex::new(HashSet::new()),
        }
    }

    fn snapshot(&self) -> Result<AiConfig, String> {
        self.config
            .lock()
            .map(|c| c.clone())
            .map_err(|e| e.to_string())
    }
}

fn config_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位配置目录: {e}"))?;
    Ok(dir.join("ai-config.json"))
}

fn read_config(app: &AppHandle) -> Option<AiConfig> {
    let path = config_file(app).ok()?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_config(app: &AppHandle, cfg: &AiConfig) -> Result<(), String> {
    let path = config_file(app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("无法创建配置目录: {e}"))?;
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("配置写入失败: {e}"))
}

fn truncate(s: &str, max: usize) -> String {
    let trimmed = s.trim();
    if trimmed.chars().count() <= max {
        return trimmed.to_string();
    }
    let head: String = trimmed.chars().take(max).collect();
    format!("{head}…")
}

/// 取出可用的 key 原文（解密）。空 = 没配置。
fn api_key_of(cfg: &AiConfig) -> Result<String, String> {
    secret::unprotect(&cfg.api_key).map_err(|e| {
        format!("API Key 无法解密（配置可能来自别的电脑或用户），请在设置里重新填写。{e}")
    })
}

#[tauri::command]
pub fn ai_get_config(state: State<'_, AiState>) -> Result<AiConfigPublic, String> {
    state.config.lock().map(|c| AiConfigPublic::from(&*c)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ai_set_config(
    app: AppHandle,
    state: State<'_, AiState>,
    config: AiConfigInput,
) -> Result<AiConfigPublic, String> {
    let mut guard = state.config.lock().map_err(|e| e.to_string())?;

    let api_key = match config.api_key {
        // Some("") = 清除；Some(non-empty) = 加密后保存
        Some(k) => {
            let k = k.trim();
            if k.is_empty() {
                String::new()
            } else {
                secret::protect(k)?
            }
        }
        // None = 保持原样（密文原封不动，不重复加密）
        None => guard.api_key.clone(),
    };

    *guard = AiConfig {
        base_url: config.base_url.trim().trim_end_matches('/').to_string(),
        model: config.model.trim().to_string(),
        temperature: config.temperature.clamp(0.0, 2.0),
        api_key,
    };

    write_config(&app, &guard)?;
    Ok(AiConfigPublic::from(&*guard))
}

#[tauri::command]
pub fn ai_cancel(state: State<'_, AiState>, id: String) -> Result<(), String> {
    let mut set = state.cancelled.lock().map_err(|e| e.to_string())?;
    set.insert(id);
    Ok(())
}

/// 发一条最小的非流式请求，验证 base_url / model / key 是否可用
#[tauri::command]
pub async fn ai_test(app: AppHandle) -> Result<String, String> {
    let cfg = {
        let state = app.state::<AiState>();
        state.snapshot()?
    };

    let api_key = api_key_of(&cfg)?;
    if api_key.trim().is_empty() {
        return Err("NO_API_KEY".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": cfg.model,
        "temperature": 0.0,
        "max_tokens": 16,
        "messages": [{ "role": "user", "content": "ping" }],
    });

    let resp = client
        .post(endpoint(&cfg))
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status.is_success() {
        Ok(format!("OK {}", status.as_u16()))
    } else {
        Err(format!("HTTP {}: {}", status.as_u16(), truncate(&text, 300)))
    }
}

fn endpoint(cfg: &AiConfig) -> String {
    format!("{}/chat/completions", cfg.base_url.trim_end_matches('/'))
}

fn emit_error(app: &AppHandle, id: &str, message: impl Into<String>) {
    let _ = app.emit(
        "ai-error",
        AiError {
            id: id.to_string(),
            message: message.into(),
        },
    );
}

#[tauri::command]
pub async fn ai_chat(app: AppHandle, request: AiChatRequest) -> Result<(), String> {
    let cfg = {
        let state = app.state::<AiState>();
        state.snapshot()?
    };

    // 清掉上一轮的取消标记，避免同 id 复用被误判
    {
        let state = app.state::<AiState>();
        if let Ok(mut set) = state.cancelled.lock() {
            set.remove(&request.id);
        }
    }

    let api_key = match api_key_of(&cfg) {
        Ok(k) => k,
        Err(e) => {
            emit_error(&app, &request.id, e);
            return Ok(());
        }
    };
    if api_key.trim().is_empty() {
        emit_error(&app, &request.id, "NO_API_KEY");
        return Ok(());
    }
    if request.messages.is_empty() {
        emit_error(&app, &request.id, "EMPTY_MESSAGES");
        return Ok(());
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            emit_error(&app, &request.id, format!("客户端创建失败: {e}"));
            return Ok(());
        }
    };

    let body = serde_json::json!({
        "model": cfg.model,
        "temperature": cfg.temperature,
        "stream": true,
        "messages": request.messages,
    });

    let resp = match client
        .post(endpoint(&cfg))
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            emit_error(&app, &request.id, format!("网络错误: {e}"));
            return Ok(());
        }
    };

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        emit_error(
            &app,
            &request.id,
            format!("HTTP {}: {}", status.as_u16(), truncate(&text, 400)),
        );
        return Ok(());
    }

    // 逐块读取 SSE。chunk() 不需要额外 feature，跨块的半行由 buf 兜住。
    let mut resp = resp;
    let mut buf = String::new();
    let mut cancelled = false;

    loop {
        if is_cancelled(&app, &request.id) {
            cancelled = true;
            break;
        }

        let chunk = match resp.chunk().await {
            Ok(Some(c)) => c,
            Ok(None) => break,
            Err(e) => {
                emit_error(&app, &request.id, format!("读取失败: {e}"));
                return Ok(());
            }
        };

        buf.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim_end_matches('\r').to_string();
            buf.drain(..=pos);

            if let Some(text) = parse_sse_line(&line) {
                let _ = app.emit(
                    "ai-delta",
                    AiDelta {
                        id: request.id.clone(),
                        text,
                    },
                );
            }

            if let Some(err) = parse_sse_error(&line) {
                emit_error(&app, &request.id, err);
                return Ok(());
            }
        }
    }

    let _ = app.emit(
        "ai-done",
        AiDone {
            id: request.id,
            cancelled,
        },
    );
    Ok(())
}

/// 解析一行 SSE 负载里的 JSON。
/// 非 `data:` 行、`[DONE]`、空负载、以及**被网络分片截断的半行 JSON** 都返回 None
/// —— 截断的半行必须安静丢弃，等下一块数据补齐，绝不能 panic 或把半截内容发出去。
fn sse_json(line: &str) -> Option<serde_json::Value> {
    let data = line.strip_prefix("data:")?.trim();
    if data.is_empty() || data == "[DONE]" {
        return None;
    }
    serde_json::from_str::<serde_json::Value>(data).ok()
}

/// 从一行 SSE 里取出增量文本（`choices[0].delta.content`）。
/// 这是流式回答的唯一正文来源。
fn parse_sse_line(line: &str) -> Option<String> {
    let value = sse_json(line)?;
    let text = value["choices"][0]["delta"]["content"].as_str()?;
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

/// 有些兼容实现把错误塞在流里（`{"error":{"message":...}}`）
fn parse_sse_error(line: &str) -> Option<String> {
    let value = sse_json(line)?;
    value["error"]["message"].as_str().map(|s| s.to_string())
}

fn is_cancelled(app: &AppHandle, id: &str) -> bool {
    let state = app.state::<AiState>();
    state
        .cancelled
        .lock()
        .map(|set| set.contains(id))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{parse_sse_error, parse_sse_line};

    #[test]
    fn parses_delta_content() {
        let line = r#"data: {"choices":[{"delta":{"content":"Hel"}}]}"#;
        assert_eq!(parse_sse_line(line).as_deref(), Some("Hel"));

        // 带 \r\n 的真实行、以及内容里有空格，都要能取出来
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\r";
        assert_eq!(parse_sse_line(line).as_deref(), Some(" world"));
    }

    #[test]
    fn ignores_non_data_and_done_lines() {
        assert_eq!(parse_sse_line(""), None);
        assert_eq!(parse_sse_line("event: ping"), None);
        assert_eq!(parse_sse_line(": keep-alive"), None);
        assert_eq!(parse_sse_line("data: [DONE]"), None);
        assert_eq!(parse_sse_line("data:"), None);
    }

    #[test]
    fn truncated_json_is_ignored_without_panic() {
        // 网络分片把一行 JSON 切断了：这半行必须安静丢弃，等下一块补齐
        let half = r#"data: {"choices":[{"delta":{"content":"He"#;
        assert_eq!(parse_sse_line(half), None);
        assert_eq!(parse_sse_error(half), None);
        // 完全不是 JSON 的行同样不能炸
        assert_eq!(parse_sse_line("data: <html>502 Bad Gateway</html>"), None);
    }

    #[test]
    fn empty_content_or_missing_fields_are_none() {
        assert_eq!(
            parse_sse_line(r#"data: {"choices":[{"delta":{"content":""}}]}"#),
            None
        );
        assert_eq!(parse_sse_line(r#"data: {"choices":[{"delta":{}}]}"#), None);
        assert_eq!(parse_sse_line(r#"data: {}"#), None);
    }

    #[test]
    fn detects_in_stream_error() {
        let line = r#"data: {"error":{"message":"invalid api key"}}"#;
        assert_eq!(parse_sse_error(line).as_deref(), Some("invalid api key"));
        // 错误行不该被当成正文
        assert_eq!(parse_sse_line(line), None);
    }
}
