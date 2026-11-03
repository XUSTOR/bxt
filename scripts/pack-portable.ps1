# 打包便携版（zip）：完全绕开 NSIS 安装器。
#
# 适用于装了安全软件、安装器报 "Error writing temporary file" 的机器 ——
# 解压即用，无 UAC、无临时文件、无安装逻辑。
#
# 用法（在项目根目录）：
#   pwsh -File scripts\pack-portable.ps1
#   或： scripts\pack-portable.ps1            （Windows PowerShell 也可）

param(
    [string]$Configuration = 'release'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "src-tauri\target\$Configuration\app.exe"

if (-not (Test-Path $exe)) {
    throw "找不到 $exe`n请先运行：npx.cmd tauri build"
}

$version = (Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).version
$outDir = Join-Path $root 'dist-portable'
$stage = Join-Path $outDir "BXT_$version"

New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item $exe (Join-Path $stage 'BXT.exe') -Force
Copy-Item (Join-Path $root 'README.md') $stage -Force

$zip = Join-Path $outDir "BXT_${version}_portable.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "便携包已生成：$zip  ($sizeMb MB)"
