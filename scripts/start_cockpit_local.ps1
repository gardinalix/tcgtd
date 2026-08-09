param(
  [int]$Port = 4173,
  [switch]$ForceBuild,
  [switch]$NoBrowser,
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RootInfo = Get-Item $Root
$RealRootPath = if ($RootInfo.Target -and $RootInfo.Target.Count -gt 0) { $RootInfo.Target[0] } else { $RootInfo.FullName }
$Url = "http://127.0.0.1:$Port/"
$LogDir = Join-Path $RealRootPath ".local\logs"
$OutLog = Join-Path $LogDir "cockpit-server.out.log"
$ErrLog = Join-Path $LogDir "cockpit-server.err.log"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CockpitOnline {
  param([string]$TargetUrl)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $TargetUrl -TimeoutSec 3
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Test-CockpitApiOnline {
  param([string]$TargetUrl)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$TargetUrl/api/auth/session" -TimeoutSec 3
    return ($response.StatusCode -eq 200 -and $response.Content.Trim().StartsWith("{"))
  } catch {
    return $false
  }
}

function Get-PortListenerPids {
  param([int]$TargetPort)
  try {
    return @(Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $rows = @(netstat -ano | Select-String ":$TargetPort")
    $pids = @()
    foreach ($row in $rows) {
      $parts = ($row.Line -split "\s+") | Where-Object { $_ }
      if ($parts.Count -ge 5 -and $parts[1] -match ":$TargetPort$" -and $parts[3] -eq "LISTENING") {
        $pids += [int]$parts[4]
      }
    }
    return @($pids | Select-Object -Unique)
  }
}

function Stop-StaleCockpitOnPort {
  param([int]$TargetPort)
  $rootMarker = $RealRootPath.ToLowerInvariant()
  $listenerPids = @(Get-PortListenerPids -TargetPort $TargetPort)
  foreach ($listenerPid in $listenerPids) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid" -ErrorAction SilentlyContinue
    $commandLine = if ($processInfo -and $processInfo.CommandLine) { $processInfo.CommandLine.ToLowerInvariant() } else { "" }
    $process = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
    $processName = if ($process) { $process.ProcessName.ToLowerInvariant() } else { "" }
    $isKnownLocalServerRuntime = $processName -eq "python" -or $processName -eq "node"
    $isProjectServer = $commandLine.Contains("serve_dist_no_cache.py") -or $commandLine.Contains("authserver.mjs") -or $commandLine.Contains($rootMarker) -or $isKnownLocalServerRuntime
    if (!$isProjectServer) {
      throw "Port $TargetPort is already used by another process (PID $listenerPid). Close it or use another port."
    }
    Write-Host "Stopping stale cockpit process on port $TargetPort (PID $listenerPid)..." -ForegroundColor Yellow
    Stop-Process -Id $listenerPid -Force
  }
}

function Normalize-ProcessEnvironment {
  $processVars = [Environment]::GetEnvironmentVariables("Process")
  $pathValue = $null
  if ($processVars.Contains("Path")) {
    $pathValue = [string]$processVars["Path"]
  } elseif ($processVars.Contains("PATH")) {
    $pathValue = [string]$processVars["PATH"]
  }

  if ($pathValue) {
    [Environment]::SetEnvironmentVariable("PATH", $null, "Process")
    [Environment]::SetEnvironmentVariable("Path", $pathValue, "Process")
  }
}

function Find-Node {
  $localNode = Join-Path $RealRootPath ".scratch\node-runtime\node-v24.14.0-win-x64\node.exe"
  if (Test-Path $localNode) {
    $nodeDir = Split-Path $localNode
    $env:Path = "$nodeDir;$env:Path"
    $env:NODE_OPTIONS = "--use-system-ca"
    return $localNode
  }
  $resolved = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($resolved) { return $resolved.Source }
  $resolved = Get-Command node -ErrorAction SilentlyContinue
  if ($resolved) { return $resolved.Source }
  return ""
}

function Find-Python {
  $candidates = @(
    "C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
    (Join-Path $RealRootPath ".scratch\python\python.exe")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  $resolved = Get-Command python -ErrorAction SilentlyContinue
  if ($resolved) { return $resolved.Source }
  throw "Python runtime not found. Open Codex once or install Python, then run this shortcut again."
}

function Find-Npm {
  $localNpm = Join-Path $RealRootPath ".scratch\node-runtime\node-v24.14.0-win-x64\npm.cmd"
  if (Test-Path $localNpm) {
    $env:Path = "$(Split-Path $localNpm);$env:Path"
    $env:NODE_OPTIONS = "--use-system-ca"
    return $localNpm
  }
  $resolved = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($resolved) { return $resolved.Source }
  $resolved = Get-Command npm -ErrorAction SilentlyContinue
  if ($resolved) { return $resolved.Source }
  throw "Node/npm runtime not found. Open Codex once or install Node.js, then run this shortcut again."
}

function Needs-Build {
  if ($ForceBuild) { return $true }
  $distIndex = Join-Path $RealRootPath "dist\index.html"
  $distData = Join-Path $RealRootPath "dist\app-data.json"
  $webData = Join-Path $RealRootPath "web\app-data.json"
  if (!(Test-Path $distIndex) -or !(Test-Path $distData)) { return $true }
  if ((Test-Path $webData) -and ((Get-Item $webData).LastWriteTime -gt (Get-Item $distData).LastWriteTime)) { return $true }
  return $false
}

Normalize-ProcessEnvironment
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "TCG Tactical Database" -ForegroundColor Yellow
Write-Host "Workspace: $RealRootPath"

if (Test-CockpitApiOnline $Url) {
  Write-Step "Cockpit already online"
  if (!$NoBrowser) { Start-Process $Url }
  Write-Host "Ready: $Url" -ForegroundColor Green
  Start-Sleep -Seconds 2
  exit 0
}

if (Test-CockpitOnline $Url) {
  Write-Step "Replacing legacy static cockpit server"
  Stop-StaleCockpitOnPort -TargetPort $Port
  Start-Sleep -Milliseconds 500
}

$Python = Find-Python

if (Needs-Build) {
  Write-Step "Preparing production build"
  $webData = Join-Path $RealRootPath "web\app-data.json"
  if (!(Test-Path $webData)) {
    Write-Host "web/app-data.json not found. Rebuilding web data..."
    & $Python (Join-Path $RealRootPath "scripts\build_gundam_web_data.py")
  }

  $Npm = Find-Npm
  Push-Location $RealRootPath
  try {
    & $Npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} else {
  Write-Step "Production build is current"
}

Write-Step "Starting local cockpit server"
$authServerScript = Join-Path $RealRootPath "server\authServer.mjs"
$Node = Find-Node
$useAuthServer = $Node -and (Test-Path $authServerScript)
$env:APP_URL = $Url.TrimEnd("/")
$env:AUTH_SERVER_PORT = "$Port"

if ($useAuthServer) {
  $serverExecutable = $Node
  $arguments = @($authServerScript)
  Write-Host "Mode: frontend + auth API" -ForegroundColor Cyan
} else {
  $serverExecutable = $Python
  $serverScript = Join-Path $RealRootPath "scripts\serve_dist_no_cache.py"
$distDir = Join-Path $RealRootPath "dist"
$arguments = @(
  $serverScript,
  "--host", "127.0.0.1",
  "--port", "$Port",
  "--directory", $distDir
)
  Write-Host "Mode: static frontend only" -ForegroundColor Yellow
}

if ($Foreground) {
  Write-Host "Keep this window open while using the cockpit." -ForegroundColor Yellow
  Write-Host "Close this window or press Ctrl+C to stop the site."
  if (!$NoBrowser) {
    Start-Job -ScriptBlock {
      param([string]$TargetUrl)
      Start-Sleep -Seconds 1
      Start-Process $TargetUrl
    } -ArgumentList $Url | Out-Null
  }
  & $serverExecutable @arguments
  exit $LASTEXITCODE
}

Start-Process `
  -FilePath $serverExecutable `
  -ArgumentList $arguments `
  -WorkingDirectory $RealRootPath `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog | Out-Null

$online = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  Start-Sleep -Milliseconds 500
  if (Test-CockpitOnline $Url) {
    $online = $true
    break
  }
}

if (!$online) {
  Write-Host "Could not start the cockpit on $Url" -ForegroundColor Red
  Write-Host "Server logs:"
  Write-Host "  $OutLog"
  Write-Host "  $ErrLog"
  if (Test-Path $ErrLog) {
    Get-Content $ErrLog -Tail 20
  }
  Read-Host "Press Enter to close"
  exit 1
}

if (!$NoBrowser) { Start-Process $Url }
Write-Host "Ready: $Url" -ForegroundColor Green
Write-Host "Logs: $LogDir"
Start-Sleep -Seconds 2
