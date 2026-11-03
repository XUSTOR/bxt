//! WebView2 的浏览器快捷键（F5 刷新、Ctrl+R、Ctrl+F、Ctrl+P、Ctrl+U……）
//! 对一个终端程序来说是干扰源：这些键该进 shell 或由我们自己绑，而不是操作网页。
//!
//! 为什么必须伸手到 WebView2 内部：浏览器级加速键在页面拿到 keydown 之前就被
//! 浏览器处理掉了，JS 里 `preventDefault()` 拦不住。WebView2 提供了一个总开关
//! `ICoreWebView2Settings3::AreBrowserAcceleratorKeysEnabled`，但 Tauri 2.12
//! 没有暴露它（wry 有 `with_browser_accelerator_keys`，tauri-runtime-wry 没用）。
//!
//! 只在 release 生效：debug 构建要留着这些键，否则自己也开不了 DevTools。

use tauri::WebviewWindow;

#[cfg(windows)]
// debug 构建不调用它（要留着 DevTools 的快捷键），所以这里允许"未使用"
#[allow(dead_code)]
pub fn disable_browser_accelerator_keys(window: &WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;

    // 这个调用只是往事件循环里排一条消息，真正的设置动作在事件循环跑起来后执行
    let queued = window.with_webview(|webview| {
        let controller = webview.controller();
        // SAFETY: 事件循环线程、webview 一定已经创建好；接口版本不对时
        // 各步都会返回 Err，我们只是安静跳过，不会 UB。
        unsafe {
            let Ok(core) = controller.CoreWebView2() else {
                log::warn!("拿不到 CoreWebView2，浏览器快捷键仍然有效");
                return;
            };
            let Ok(settings) = core.Settings() else {
                log::warn!("拿不到 WebView2 设置，浏览器快捷键仍然有效");
                return;
            };
            let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() else {
                log::warn!("WebView2 版本太旧（< 88），无法关闭浏览器快捷键");
                return;
            };
            if let Err(e) = settings3.SetAreBrowserAcceleratorKeysEnabled(false) {
                log::warn!("关闭 WebView2 浏览器快捷键失败: {e}");
            }
        }
    });

    if let Err(e) = queued {
        log::warn!("无法把关闭浏览器快捷键的任务排进事件循环: {e}");
    }
}

#[cfg(not(windows))]
pub fn disable_browser_accelerator_keys(_window: &WebviewWindow) {
    // 其它平台没有这个开关，行为保持不变
}
