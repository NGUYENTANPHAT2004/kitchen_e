param(
    [int]$ApiPort = 5000,
    [int]$WebPort = 5173,
    [int]$AiPort = 8000,
    [switch]$IncludeDatabase
)
$ErrorActionPreference = 'Stop'
$targets = @(
    @{ Port = $ApiPort; Marker = (Join-Path $PSScriptRoot 'be/scripts/start-local.js') },
    @{ Port = $WebPort; Marker = (Join-Path $PSScriptRoot 'fe/node_modules/vite/bin/vite.js') },
    @{ Port = $AiPort; Marker = (Join-Path $PSScriptRoot 'py-ai/start_local.py') }
)
if ($IncludeDatabase) {
    $targets += @{ Port = 27018; Marker = (Join-Path $PSScriptRoot '.local/mongo') }
}
foreach ($target in $targets) {
    $listener = Get-NetTCPConnection -LocalPort $target.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$listener) { continue }
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $command = ($owner.CommandLine -replace '/', '\').ToLowerInvariant()
    $marker = ($target.Marker -replace '/', '\').ToLowerInvariant()
    if (!$command.Contains($marker)) {
        throw "Refusing to stop unrelated process $($owner.ProcessId) on port $($target.Port)."
    }
    Stop-Process -Id $owner.ProcessId
    Write-Host "Stopped Kitchen E process $($owner.ProcessId) on port $($target.Port)."
}
