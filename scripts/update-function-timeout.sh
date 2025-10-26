#!/bin/bash
set -e
if [ -z "$1" ]; then
  echo "Usage: update-function-timeout.sh <FunctionName> <TimeoutSeconds>" >&2
  exit 1
fi
FUNC_NAME="$1"
TIMEOUT="$2"
if [ -z "$TIMEOUT" ]; then
  TIMEOUT=120
fi
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/.venv/bin/activate"
python3 -m pip install --quiet tccli
ENV_ID=$(grep '^TCB_ENV=' "$ROOT_DIR/.env" | tail -n1 | cut -d '=' -f2 | tr -d '\r')
REGION=$(grep '^TCB_REGION=' "$ROOT_DIR/.env" | tail -n1 | cut -d '=' -f2 | tr -d '\r')
if [ -z "$REGION" ]; then
  REGION=ap-shanghai
fi
if [ -z "$ENV_ID" ]; then
  echo "TCB_ENV is required" >&2
  exit 1
fi

tccli scf UpdateFunctionConfiguration \
  --FunctionName "$FUNC_NAME" \
  --Namespace "$ENV_ID" \
  --Timeout "$TIMEOUT" \
  --region "$REGION"
