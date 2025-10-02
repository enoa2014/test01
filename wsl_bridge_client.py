#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Dict


def parse_env_overrides(items):
    env = {}
    for item in items:
        if "=" not in item:
            raise ValueError(f"environment override '{item}' is missing '='")
        key, value = item.split("=", 1)
        if not key:
            raise ValueError("environment override key cannot be empty")
        env[key] = value
    return env


def request_execution(args, payload):
    url = f"http://{args.host}:{args.port}/execute"
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    if args.token:
        request.add_header("X-Auth-Token", args.token)
    return urllib.request.urlopen(request, timeout=args.request_timeout)


def main():
    parser = argparse.ArgumentParser(
        description="Send commands from WSL Codex CLI to Windows agent for execution"
    )
    parser.add_argument("--host", default="127.0.0.1", help="Command bridge server host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Command bridge server port (default: 8765)")
    parser.add_argument("--token", help="Shared secret that must match the server configuration")
    parser.add_argument("--cwd", help="Working directory for the Windows command")
    parser.add_argument("--shell", action="store_true", help="Execute via Windows shell (cmd.exe)")
    parser.add_argument("--timeout", type=float, help="Kill the Windows command after N seconds")
    parser.add_argument("--request-timeout", type=float, default=30.0, help="HTTP timeout in seconds (default: 30)")
    parser.add_argument(
        "--env",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Environment override passed to the Windows command",
    )
    parser.add_argument("--show-meta", action="store_true", help="Print exit code and duration on stderr")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command to execute in Windows (prefix with -- to separate)")
    args = parser.parse_args()

    command_parts = list(args.command)
    if command_parts and command_parts[0] == "--":
        command_parts = command_parts[1:]

    if not command_parts:
        parser.error("missing command to execute; pass it after '--'")

    if args.shell:
        command_payload = subprocess.list2cmdline(command_parts)
    else:
        command_payload = command_parts

    try:
        env_payload = parse_env_overrides(args.env)
    except ValueError as exc:
        parser.error(str(exc))

    payload: Dict[str, object] = {"command": command_payload}
    if args.shell:
        payload["shell"] = True
    if args.cwd:
        payload["cwd"] = args.cwd
    if args.timeout is not None:
        if args.timeout <= 0:
            parser.error("--timeout must be greater than zero")
        payload["timeout"] = args.timeout
    if env_payload:
        payload["env"] = env_payload
    if not sys.stdin.isatty():
        payload["stdin"] = sys.stdin.read()

    try:
        with request_execution(args, payload) as response:
            response_body = response.read().decode("utf-8")
            result = json.loads(response_body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        message = body.strip() or str(exc)
        try:
            parsed = json.loads(body)
            message = parsed.get("error", message)
            if isinstance(parsed.get("stdout"), str):
                sys.stdout.write(parsed["stdout"])
            if isinstance(parsed.get("stderr"), str):
                sys.stderr.write(parsed["stderr"])
        except json.JSONDecodeError:
            pass
        sys.stderr.write(f"Command bridge error ({exc.code}): {message}\n")
        sys.exit(1)
    except urllib.error.URLError as exc:
        sys.stderr.write(f"Failed to reach command bridge server: {exc}\n")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"Invalid JSON response from server: {exc}\n")
        sys.exit(1)

    stdout_text = result.get("stdout", "")
    stderr_text = result.get("stderr", "")
    exit_code = result.get("exit_code", 0)
    duration = result.get("duration_ms")

    if isinstance(stdout_text, str):
        sys.stdout.write(stdout_text)
    if isinstance(stderr_text, str):
        sys.stderr.write(stderr_text)

    if args.show_meta:
        meta_parts = [f"exit_code={exit_code}"]
        if isinstance(duration, (int, float)):
            meta_parts.append(f"duration_ms={int(duration)}")
        sys.stderr.write(f"[command-bridge] {' '.join(meta_parts)}\n")

    try:
        exit_code_int = int(exit_code)
    except (TypeError, ValueError):
        exit_code_int = 1
    sys.exit(exit_code_int)


if __name__ == "__main__":
    main()
