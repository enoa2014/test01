#!/bin/bash
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/.venv/bin/activate"
python3 -m pip install --quiet tccli
SECRET_ID=$(grep '^TENCENTCLOUD_SECRETID=' "$ROOT_DIR/.env" | tail -n1 | cut -d '=' -f2 | tr -d '\r')
SECRET_KEY=$(grep '^TENCENTCLOUD_SECRETKEY=' "$ROOT_DIR/.env" | tail -n1 | cut -d '=' -f2 | tr -d '\r')
REGION_LINE=$(grep '^TCB_REGION=' "$ROOT_DIR/.env" | tail -n1)
if [ -n "$REGION_LINE" ]; then
  REGION=$(echo "$REGION_LINE" | cut -d '=' -f2 | tr -d '\r')
else
  REGION=ap-shanghai
fi

tccli configure set secretId "$SECRET_ID"
tccli configure set secretKey "$SECRET_KEY"
tccli configure set region "$REGION"
