$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RootInfo = Get-Item $Root
$RealRootPath = if ($RootInfo.Target -and $RootInfo.Target.Count -gt 0) { $RootInfo.Target[0] } else { $RootInfo.FullName }

$LocalNode = Join-Path $Root ".scratch\node-runtime\node-v24.14.0-win-x64"
Push-Location $RealRootPath
try {
  if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host ".env created from .env.example. Fill AUTH_SECRET and provider credentials before OAuth testing."
  }

  if (Test-Path (Join-Path $LocalNode "npm.cmd")) {
    $env:PATH = "$LocalNode;$env:PATH"
    & (Join-Path $LocalNode "npm.cmd") run migrate:auth
    & (Join-Path $LocalNode "npm.cmd") run auth
  } else {
    npm run migrate:auth
    npm run auth
  }
} finally {
  Pop-Location
}
