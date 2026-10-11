$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PORT = '3100'
$listener = $false
try {
    Invoke-WebRequest -Uri 'http://127.0.0.1:3100/health' -UseBasicParsing -TimeoutSec 2 | Out-Null
    $listener = $true
} catch {}
if (-not $listener) {
    Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot/local-server.log" -RedirectStandardError "$PSScriptRoot/local-server-error.log"
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            Invoke-WebRequest -Uri 'http://127.0.0.1:3100' -UseBasicParsing -TimeoutSec 2 | Out-Null
            $ready = $true
            break
        } catch {}
    }
    if (-not $ready) { throw 'Game failed to start; check local-server-error.log.' }
}
Write-Host 'Game: http://localhost:3100'
& tailscale funnel --bg 3100
if ($LASTEXITCODE -ne 0) { throw 'Game is running, but Tailscale Funnel failed to start.' }
