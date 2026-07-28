@echo off
setlocal
set "ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start_cockpit_local.ps1" -Foreground
if errorlevel 1 (
  echo.
  echo The cockpit launcher failed. Check the message above and share it with Codex if needed.
  pause
)
endlocal
