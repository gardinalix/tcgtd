from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_NODE_PATHS = [
    ROOT / ".scratch" / "node-runtime" / "node-v24.14.0-win-x64" / "node.exe",
    Path.home()
    / ".cache"
    / "codex-runtimes"
    / "codex-primary-runtime"
    / "dependencies"
    / "node"
    / "bin"
    / "node.exe",
]


def find_node_executable() -> str | None:
    for path in DEFAULT_NODE_PATHS:
        if path.exists():
            return str(path)
    for candidate in ("node.exe", "node"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def fetch_text_via_node(url: str, *, user_agent: str | None = None, timeout_seconds: int = 45) -> str:
    node_executable = find_node_executable()
    if not node_executable:
        raise RuntimeError("Node.js executable not found for fetch fallback.")

    env = {
        **os.environ,
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "CODEX_FETCH_URL": url,
        "CODEX_FETCH_UA": user_agent or "",
        "CODEX_FETCH_TIMEOUT_MS": str(int(timeout_seconds * 1000)),
    }
    script = r"""
const url = process.env.CODEX_FETCH_URL;
const ua = process.env.CODEX_FETCH_UA || "";
const timeoutMs = Number(process.env.CODEX_FETCH_TIMEOUT_MS || "45000");
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

fetch(url, {
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    ...(ua ? { "User-Agent": ua } : {}),
  },
  signal: controller.signal,
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  process.stdout.write(await response.text());
}).catch((error) => {
  console.error(String(error && error.stack ? error.stack : error));
  process.exit(1);
}).finally(() => clearTimeout(timer));
"""
    completed = subprocess.run(
        [node_executable, "-e", script],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        check=False,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(message or f"Node fetch failed for {url}")
    return completed.stdout or ""


def download_file_via_node(
    url: str,
    target_path: Path,
    *,
    user_agent: str | None = None,
    timeout_seconds: int = 45,
) -> None:
    node_executable = find_node_executable()
    if not node_executable:
        raise RuntimeError("Node.js executable not found for download fallback.")

    env = {
        **os.environ,
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "CODEX_FETCH_URL": url,
        "CODEX_FETCH_UA": user_agent or "",
        "CODEX_FETCH_TIMEOUT_MS": str(int(timeout_seconds * 1000)),
        "CODEX_FETCH_OUTFILE": str(target_path),
    }
    script = r"""
const fs = require("fs");
const url = process.env.CODEX_FETCH_URL;
const outFile = process.env.CODEX_FETCH_OUTFILE;
const ua = process.env.CODEX_FETCH_UA || "";
const timeoutMs = Number(process.env.CODEX_FETCH_TIMEOUT_MS || "45000");
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

fetch(url, {
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    ...(ua ? { "User-Agent": ua } : {}),
  },
  signal: controller.signal,
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(outFile, Buffer.from(arrayBuffer));
}).catch((error) => {
  console.error(String(error && error.stack ? error.stack : error));
  process.exit(1);
}).finally(() => clearTimeout(timer));
"""
    completed = subprocess.run(
        [node_executable, "-e", script],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        check=False,
    )
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(message or f"Node download failed for {url}")


def fetch_text(
    url: str,
    *,
    user_agent: str | None = None,
    timeout_seconds: int = 45,
) -> str:
    env = {
        **os.environ,
        "CODEX_FETCH_URL": url,
        "CODEX_FETCH_UA": user_agent or "",
        "CODEX_FETCH_TIMEOUT_SEC": str(int(timeout_seconds)),
    }

    ps = r"""
$ErrorActionPreference = "Stop"
$url = $env:CODEX_FETCH_URL
$ua = $env:CODEX_FETCH_UA
$timeout = [int]($env:CODEX_FETCH_TIMEOUT_SEC)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$headers = @{ "Accept-Language" = "en-US,en;q=0.9" }
if ($ua) { $headers["User-Agent"] = $ua }

$res = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -TimeoutSec $timeout
if ($null -eq $res) { throw "No response for $url" }
$content = $res.Content
if ($null -eq $content) { $content = "" }
[Console]::Out.Write($content)
"""

    completed = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        check=False,
    )
    if completed.returncode != 0:
        ps_stderr = (completed.stderr or "").strip()
        ps_stdout = (completed.stdout or "").strip()
        if shutil.which("curl.exe"):
            curl_command = [
                "curl.exe",
                "--http1.1",
                "-L",
                "--silent",
                "--show-error",
                "--ssl-no-revoke",
                "--max-time",
                str(int(timeout_seconds)),
            ]
            if user_agent:
                curl_command.extend(["-A", user_agent])
            curl_command.append(url)
            curl_completed = subprocess.run(
                curl_command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
            if curl_completed.returncode == 0:
                return curl_completed.stdout or ""
            curl_message = (curl_completed.stderr or curl_completed.stdout or "").strip()
            try:
                return fetch_text_via_node(
                    url,
                    user_agent=user_agent,
                    timeout_seconds=timeout_seconds,
                )
            except Exception as node_error:
                raise RuntimeError(
                    str(node_error)
                    or curl_message
                    or ps_stderr
                    or ps_stdout
                    or f"Fetch failed for {url} (PowerShell exit {completed.returncode}, curl exit {curl_completed.returncode})"
                ) from node_error
        message = ps_stderr or ps_stdout or f"Fetch failed for {url} (exit {completed.returncode})"
        raise RuntimeError(message)

    return completed.stdout or ""


def download_file(
    url: str,
    target_path: Path,
    *,
    user_agent: str | None = None,
    timeout_seconds: int = 45,
) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)

    env = {
        **os.environ,
        "CODEX_FETCH_URL": url,
        "CODEX_FETCH_UA": user_agent or "",
        "CODEX_FETCH_TIMEOUT_SEC": str(int(timeout_seconds)),
        "CODEX_FETCH_OUTFILE": str(target_path),
    }

    ps = r"""
$ErrorActionPreference = "Stop"
$url = $env:CODEX_FETCH_URL
$ua = $env:CODEX_FETCH_UA
$timeout = [int]($env:CODEX_FETCH_TIMEOUT_SEC)
$outFile = $env:CODEX_FETCH_OUTFILE

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$headers = @{ "Accept-Language" = "en-US,en;q=0.9" }
if ($ua) { $headers["User-Agent"] = $ua }

Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -TimeoutSec $timeout -OutFile $outFile | Out-Null
"""

    completed = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        check=False,
    )
    if completed.returncode != 0:
        ps_stderr = (completed.stderr or "").strip()
        ps_stdout = (completed.stdout or "").strip()
        if shutil.which("curl.exe"):
            curl_command = [
                "curl.exe",
                "--http1.1",
                "-L",
                "--silent",
                "--show-error",
                "--ssl-no-revoke",
                "--max-time",
                str(int(timeout_seconds)),
                "-o",
                str(target_path),
            ]
            if user_agent:
                curl_command.extend(["-A", user_agent])
            curl_command.append(url)
            curl_completed = subprocess.run(curl_command, capture_output=True, text=True, check=False)
            if curl_completed.returncode == 0:
                return
            curl_message = (curl_completed.stderr or curl_completed.stdout or "").strip()
            try:
                download_file_via_node(
                    url,
                    target_path,
                    user_agent=user_agent,
                    timeout_seconds=timeout_seconds,
                )
                return
            except Exception as node_error:
                raise RuntimeError(
                    str(node_error)
                    or curl_message
                    or ps_stderr
                    or ps_stdout
                    or f"Download failed for {url} (PowerShell exit {completed.returncode}, curl exit {curl_completed.returncode})"
                ) from node_error
        message = ps_stderr or ps_stdout or f"Download failed for {url} (exit {completed.returncode})"
        raise RuntimeError(message)
