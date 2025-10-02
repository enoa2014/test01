#!/usr/bin/env python3
import argparse
import json
import locale
import os
import shutil
import subprocess
import sys
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Any, Dict, Optional


DEFAULT_ENCODING = "utf-8"
if sys.platform.startswith("win"):
    DEFAULT_ENCODING = "mbcs"
else:
    preferred_encoding = locale.getpreferredencoding(False)
    if preferred_encoding:
        DEFAULT_ENCODING = preferred_encoding


def decode_stream(data: bytes) -> str:
    if not data:
        return ""

    candidates = []
    if sys.platform.startswith("win"):
        candidates.extend(["utf-8", DEFAULT_ENCODING])
    else:
        candidates.extend([DEFAULT_ENCODING, "utf-8"])

    seen = set()
    for encoding_name in candidates:
        if not encoding_name or encoding_name in seen:
            continue
        seen.add(encoding_name)
        try:
            return data.decode(encoding_name)
        except UnicodeDecodeError:
            continue

    return data.decode(DEFAULT_ENCODING, errors="replace")


class CommandHTTPServer(ThreadingHTTPServer):
    def __init__(self, server_address, RequestHandlerClass, auth_token: Optional[str], verbose: bool):
        super().__init__(server_address, RequestHandlerClass)
        self.auth_token = auth_token
        self.verbose = verbose


class CommandRequestHandler(BaseHTTPRequestHandler):
    server_version = "WSLCommandBridge/1.0"

    def do_POST(self):
        if self.path != "/execute":
            self._json_response(404, {"error": "not found"})
            return
        if self.server.auth_token:
            token = self.headers.get("X-Auth-Token")
            if token != self.server.auth_token:
                self._json_response(401, {"error": "unauthorized"})
                return
        content_length = self.headers.get("Content-Length")
        if not content_length:
            self._json_response(400, {"error": "missing content-length"})
            return
        try:
            raw_body = self.rfile.read(int(content_length))
        except (ValueError, OSError) as exc:
            self._json_response(400, {"error": f"failed to read request body: {exc}"})
            return
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            self._json_response(400, {"error": f"invalid json payload: {exc}"})
            return

        command = payload.get("command")
        if command is None:
            self._json_response(400, {"error": "missing 'command' field"})
            return
        shell_flag = payload.get("shell")
        run_shell = False

        if isinstance(command, str):
            run_shell = True if shell_flag is None else bool(shell_flag)
            cmd_to_run = command
        elif isinstance(command, list):
            run_shell = False if shell_flag is None else bool(shell_flag)
            if run_shell:
                self._json_response(400, {"error": "list commands require shell=false"})
                return
            cmd_to_run = [str(part) for part in command]
        else:
            self._json_response(400, {"error": "'command' must be a string or list"})
            return

        cwd = payload.get("cwd")
        if cwd:
            cwd = os.path.expanduser(str(cwd))
            if not os.path.isdir(cwd):
                self._json_response(400, {"error": f"working directory '{cwd}' does not exist"})
                return
        env_updates = payload.get("env") or {}
        if not isinstance(env_updates, dict):
            self._json_response(400, {"error": "'env' must be an object"})
            return
        env = os.environ.copy()
        for key, value in env_updates.items():
            env[str(key)] = str(value)
        timeout = payload.get("timeout")
        if timeout is not None:
            try:
                timeout = float(timeout)
            except (TypeError, ValueError):
                self._json_response(400, {"error": "'timeout' must be a number"})
                return
            if timeout <= 0:
                self._json_response(400, {"error": "'timeout' must be greater than zero"})
                return
        stdin_data = payload.get("stdin")
        if stdin_data is not None and not isinstance(stdin_data, str):
            self._json_response(400, {"error": "'stdin' must be a string"})
            return
        start_time = time.time()
        command_to_run = cmd_to_run
        shell_to_use = run_shell
        if not run_shell and isinstance(cmd_to_run, list) and sys.platform.startswith("win"):
            search_path = env.get("PATH") if env else None
            resolved = shutil.which(cmd_to_run[0], path=search_path)
            if resolved:
                remaining = cmd_to_run[1:]
                if resolved.lower().endswith((".bat", ".cmd")):
                    shell_to_use = True
                    command_to_run = subprocess.list2cmdline([resolved, *remaining])
                else:
                    command_to_run = [resolved, *remaining]

        if getattr(self.server, "verbose", False):
            print(f"Executing: {command_to_run!r} shell={shell_to_use} cwd={cwd or os.getcwd()}")

        try:
            result = subprocess.run(
                command_to_run,
                input=stdin_data.encode(DEFAULT_ENCODING) if isinstance(stdin_data, str) else stdin_data,
                capture_output=True,
                text=False,
                shell=shell_to_use,
                cwd=cwd,
                env=env,
                timeout=timeout,
            )
        except FileNotFoundError as exc:
            self._json_response(500, {"error": f"command not found: {exc}"})
            return
        except subprocess.TimeoutExpired as exc:
            self._json_response(504, {
                "error": "timeout",
                "stdout": exc.stdout or "",
                "stderr": exc.stderr or "",
                "duration_ms": int((time.time() - start_time) * 1000),
            })
            return
        except Exception as exc:
            self._json_response(500, {"error": f"failed to execute command: {exc}"})
            return

        stdout_text = decode_stream(result.stdout)
        stderr_text = decode_stream(result.stderr)

        response_payload = {
            "exit_code": result.returncode,
            "stdout": stdout_text,
            "stderr": stderr_text,
            "duration_ms": int((time.time() - start_time) * 1000),
        }
        self._json_response(200, response_payload)

    def log_message(self, format, *args):
        if self.server.verbose:
            super().log_message(format, *args)

    def _json_response(self, status_code: int, body: Dict[str, Any]):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def parse_args():
    parser = argparse.ArgumentParser(description="Windows command execution agent for WSL bridge")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on (default: 8765)")
    parser.add_argument("--token", help="Optional shared secret required in X-Auth-Token header")
    parser.add_argument("--verbose", action="store_true", help="Enable request logging")
    return parser.parse_args()


def run_server():
    args = parse_args()
    server = CommandHTTPServer((args.host, args.port), CommandRequestHandler, args.token, args.verbose)
    banner = f"Command bridge server listening on http://{args.host}:{args.port}"
    if args.token:
        banner += " (token required)"
    print(banner)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
