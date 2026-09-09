param(
    [ValidateRange(1024, 65535)][int]$ApiPort = 5000,
    [ValidateRange(1024, 65535)][int]$WebPort = 5173,
    [ValidateRange(1024, 65535)][int]$AiPort = 8000,
    [string]$MongoPath = '',
    [string]$PythonPath = '',
    [switch]$Seed,
    [switch]$SkipAI,
    [switch]$EnableAI,
    [string]$Integrations = ''
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$local = Join-Path $root '.local'
$node = (Get-Command node -ErrorAction Stop).Source
$selected = @($Integrations.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique)
foreach ($name in $selected) {
    if ($name -notin @('google', 'facebook', 'smtp', 's3', 'vnpay', 'ai')) { throw 'Unknown integration. Allowed: google, facebook, smtp, s3, vnpay, ai.' }
}
$integrationArgs = if ($selected.Count) { '--integrations=' + ($selected -join ',') } else { '' }
$runLocalAI = !$SkipAI -and ('ai' -notin $selected)
$ports = @($ApiPort, $WebPort, 27018)
if ($runLocalAI) { $ports += $AiPort }
if (@($ports | Sort-Object -Unique).Count -ne $ports.Count) {
    throw 'API, web, AI and database ports must be different.'
}
if ($EnableAI -and !$runLocalAI) {
    throw '-EnableAI requires local Python AI. Configure external AI through the management settings.'
}
foreach ($project in @('be', 'fe')) {
    if (!(Test-Path -LiteralPath (Join-Path $root "$project/node_modules"))) {
        throw "Install dependencies first: npm --prefix $project ci"
    }
}
New-Item -ItemType Directory -Path (Join-Path $local 'mongo') -Force | Out-Null
if ($runLocalAI) {
    if (!$PythonPath) {
        $venvPython = Join-Path $root 'py-ai/.venv/Scripts/python.exe'
        if (Test-Path -LiteralPath $venvPython) { $PythonPath = $venvPython }
        else {
            $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
            if ($pythonCommand) { $PythonPath = $pythonCommand.Source }
        }
    }
    if (!$PythonPath -or !(Test-Path -LiteralPath $PythonPath)) {
        throw 'Python is required. Pass -PythonPath with python.exe or -SkipAI to start commerce only.'
    }
    & $PythonPath -c 'import fastapi, uvicorn, motor.motor_asyncio, pydantic_settings, dotenv, multipart, aiofiles, aiohttp, numpy, pandas, sklearn'
    if ($LASTEXITCODE -ne 0) {
        throw 'Install the local AI dependencies with your Python interpreter: python -m pip install -r py-ai/requirements-local.txt'
    }
}

function Get-Listener([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}
function Wait-Url([string]$Url) {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw "Service did not become ready: $Url. Check .local logs."
}
function Start-NodeService([int]$Port, [string]$Script, [string]$Directory, [string]$Name, [string]$ExtraArgs = '') {
    $listener = Get-Listener $Port
    if ($listener) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (!$owner.CommandLine -or !$owner.CommandLine.Contains($Script)) {
            throw "Port $Port is occupied by another service. Choose another -ApiPort or -WebPort."
        }
        if ($Name -eq 'backend') {
            $runningArgs = if ($owner.CommandLine -match '--integrations=([a-z,]+)') { $Matches[0] } else { '' }
            if ($runningArgs -ne $ExtraArgs) { throw 'Backend is running with different integrations. Stop it with stop-local.ps1 before changing modes.' }
        }
        Write-Host "$Name already running on port $Port (PID $($owner.ProcessId))."
        return
    }
    $process = Start-Process -FilePath $node -ArgumentList "`"$Script`" $ExtraArgs" -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $local "$Name.log") -RedirectStandardError (Join-Path $local "$Name-error.log")
    Write-Host "$Name started (PID $($process.Id))."
}

function Start-PythonService {
    $script = Join-Path $root 'py-ai/start_local.py'
    $listener = Get-Listener $AiPort
    if ($listener) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (!$owner.CommandLine -or !$owner.CommandLine.Contains($script)) {
            throw "Port $AiPort is occupied by another service. Choose another -AiPort."
        }
        Write-Host "Python AI already running on port $AiPort (PID $($owner.ProcessId))."
        return
    }
    $process = Start-Process -FilePath $PythonPath -ArgumentList "-X utf8 -u `"$script`"" -WorkingDirectory (Join-Path $root 'py-ai') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $local 'python-ai.log') -RedirectStandardError (Join-Path $local 'python-ai-error.log')
    Write-Host "Python AI started (PID $($process.Id))."
}

if (!(Get-Listener 27018)) {
    if (!$MongoPath) {
        $mongoCommand = Get-Command mongod -ErrorAction SilentlyContinue
        if ($mongoCommand) { $MongoPath = $mongoCommand.Source }
        else {
            $MongoPath = Get-ChildItem -Path 'C:/Program Files/MongoDB/Server/*/bin/mongod.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
        }
    }
    if (!$MongoPath -or !(Test-Path -LiteralPath $MongoPath)) { throw 'MongoDB is required. Pass -MongoPath with the path to mongod.exe.' }
    $dbPath = Join-Path $local 'mongo'
    $logPath = Join-Path $local 'mongo.log'
    $mongo = Start-Process -FilePath $MongoPath -ArgumentList "--dbpath `"$dbPath`" --logpath `"$logPath`" --logappend --port 27018 --bind_ip 127.0.0.1 --replSet kitchenLocal" -WindowStyle Hidden -PassThru
    Write-Host "MongoDB started (PID $($mongo.Id))."
}
& $node (Join-Path $root 'be/scripts/init-local-db.js')
if ($LASTEXITCODE -ne 0) { throw 'Local database initialization failed.' }
if ($Seed) {
    & $node (Join-Path $root 'be/scripts/seed-local.js')
    if ($LASTEXITCODE -ne 0) { throw 'Local seed failed.' }
}

$names = @('LOCAL_API_PORT', 'LOCAL_WEB_PORT', 'LOCAL_AI_PORT', 'VITE_API_BASE_URL')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:LOCAL_API_PORT = "$ApiPort"
    $env:LOCAL_WEB_PORT = "$WebPort"
    $env:LOCAL_AI_PORT = "$AiPort"
    $env:VITE_API_BASE_URL = "http://127.0.0.1:$ApiPort"
    if ($runLocalAI) {
        Start-PythonService
        Wait-Url "http://127.0.0.1:$AiPort/health"
        if ($EnableAI) {
            & $node (Join-Path $root 'be/scripts/enable-local-ai.js')
            if ($LASTEXITCODE -ne 0) { throw 'Local chat activation failed.' }
        }
    }
    Start-NodeService $ApiPort (Join-Path $root 'be/scripts/start-local.js') (Join-Path $root 'be') 'backend' $integrationArgs
    Wait-Url "http://127.0.0.1:$ApiPort/api/health"
    Start-NodeService $WebPort (Join-Path $root 'fe/node_modules/vite/bin/vite.js') (Join-Path $root 'fe') 'frontend' "--host 127.0.0.1 --port $WebPort --strictPort"
    Wait-Url "http://127.0.0.1:$WebPort"
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
Write-Host "Store: http://127.0.0.1:$WebPort"
Write-Host "Admin: http://127.0.0.1:$WebPort/dashboard"
if ($runLocalAI) { Write-Host "Python AI docs: http://127.0.0.1:$AiPort/docs" }
Write-Host 'Services run in the background. Logs are in .local; no external database is used.'
