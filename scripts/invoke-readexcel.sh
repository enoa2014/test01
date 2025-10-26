#!/bin/bash
set -e
SYNC_BATCH=${1:-raw-reinit-20240607}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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
cd "$ROOT_DIR"
PARAMS="{\"action\":\"normalizeFromRaw\",\"syncBatchId\":\"$SYNC_BATCH\"}"
CMD=(tcb fn invoke readExcel --params "$PARAMS")
if [ -n "$TCB_ENV" ]; then
  CMD+=( -e "$TCB_ENV" )
fi
"${CMD[@]}"
