#!/bin/bash
set -e
if [ -z "$1" ]; then
  echo "Usage: deploy-function.sh <functionName> [extra tcb args...]" >&2
  exit 1
fi
FUNC_NAME="$1"
shift || true
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FUNC_DIR="$ROOT_DIR/cloudfunctions/$FUNC_NAME"
if [ ! -d "$FUNC_DIR" ]; then
  echo "Function directory not found: $FUNC_DIR" >&2
  exit 1
fi
ENV_FILE="$ROOT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    line="${line%$'\r'}"
    if [[ -z "$line" || "$line" =~ ^# ]]; then
      continue
    fi
    if [[ "$line" == *=* ]]; then
      key="${line%%=*}"
      value="${line#*=}"
      export "$key"="$value"
    fi
  done < "$ENV_FILE"
fi
cd "$FUNC_DIR"
TCB_CMD=(tcb fn deploy "$FUNC_NAME" --dir . --force)
if [ $# -gt 0 ]; then
  for arg in "$@"; do
    TCB_CMD+=("$arg")
  done
fi
if [ -n "$TCB_ENV" ]; then
  TCB_CMD+=(-e "$TCB_ENV")
fi
"${TCB_CMD[@]}"
