//! API Key 的本地加密（Windows DPAPI）。
//!
//! 磁盘上的格式是 `dpapi:<base64(密文)>`，没有这个前缀就当作旧版明文
//! （`ai::AiState::load` 会把它加密后重写一次，迁移完磁盘上不再留明文）。
//!
//! DPAPI 的作用域是「当前 Windows 用户 + 本机」：把配置文件拷到别的电脑或
//! 别的用户下都解不开，所以配置目录被同步/备份出去也不会直接暴露 key。

const PREFIX: &str = "dpapi:";

/// 这个字符串是否已经是密文
pub fn is_encrypted(stored: &str) -> bool {
    stored.starts_with(PREFIX)
}

fn b64_encode(bytes: &[u8]) -> String {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn b64_decode(text: &str) -> Result<Vec<u8>, String> {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(text)
        .map_err(|e| format!("密文格式错误: {e}"))
}

/// 加密。空串原样返回（表示"没有 key"）。
#[cfg(windows)]
pub fn protect(plain: &str) -> Result<String, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    if plain.is_empty() {
        return Ok(String::new());
    }

    let bytes = plain.as_bytes();
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!(
            "DPAPI 加密失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    let blob = unsafe {
        std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec()
    };
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };

    Ok(format!("{PREFIX}{}", b64_encode(&blob)))
}

/// 解密。空串返回空串；没有前缀视为旧版明文，原样返回。
#[cfg(windows)]
pub fn unprotect(stored: &str) -> Result<String, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    if stored.is_empty() {
        return Ok(String::new());
    }
    let Some(tail) = stored.strip_prefix(PREFIX) else {
        return Ok(stored.to_string());
    };

    let mut blob = b64_decode(tail)?;
    let input = CRYPT_INTEGER_BLOB {
        cbData: blob.len() as u32,
        pbData: blob.as_mut_ptr(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let ok = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!(
            "DPAPI 解密失败: {}",
            std::io::Error::last_os_error()
        ));
    }

    let plain = unsafe {
        std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec()
    };
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };

    String::from_utf8(plain).map_err(|e| format!("解密结果不是合法 UTF-8: {e}"))
}

/// 非 Windows 平台（正常不会编译到这里）：退化为不加密
#[cfg(not(windows))]
pub fn protect(_plain: &str) -> Result<String, String> {
    Err("当前平台不支持本地加密".into())
}

#[cfg(not(windows))]
pub fn unprotect(stored: &str) -> Result<String, String> {
    Ok(stored.to_string())
}
