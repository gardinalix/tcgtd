$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$RootInfo = Get-Item $Root
$RealRootPath = if ($RootInfo.Target -and $RootInfo.Target.Count -gt 0) { $RootInfo.Target[0] } else { $RootInfo.FullName }

$LocalNode = Join-Path $Root ".scratch\node-runtime\node-v24.14.0-win-x64"
if (Test-Path (Join-Path $LocalNode "npm.cmd")) {
  $env:PATH = "$LocalNode;$env:PATH"
  $env:NODE_OPTIONS = "--use-system-ca"
  Push-Location $RealRootPath
  try {
    & (Join-Path $LocalNode "npm.cmd") run dev
  } finally {
    Pop-Location
  }
  exit $LASTEXITCODE
}

Push-Location $RealRootPath
try {
  npm run dev
} finally {
  Pop-Location
}
