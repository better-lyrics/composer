#!/usr/bin/env bash
#
# Upload the HubertFA alignment assets to the R2 bucket that serves the vocal
# separation model (VITE_VOCAL_MODEL_BASE_URL). The bucket's CORS rules are set
# by ./scripts/upload-htdemucs.sh and cover these files too.
#
# The model is 396 MiB, over wrangler's 300 MiB upload limit, so this uses R2's
# S3-compatible API, where the AWS CLI uploads large files in parts. Run
# `pnpm install` first: the Japanese dictionary comes from node_modules.
#
# Usage:
#   ./scripts/upload-hubertfa.sh <bucket-name> [assets_dir]
#
# Requires the AWS CLI and an R2 API token with Object Read & Write on the bucket
# (Cloudflare dashboard > R2 > Manage R2 API Tokens):
#   export CLOUDFLARE_ACCOUNT_ID=...
#   export R2_ACCESS_KEY_ID=...
#   export R2_SECRET_ACCESS_KEY=...

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <bucket-name> [assets_dir]" >&2
  exit 1
fi

BUCKET="$1"
ASSETS_DIR="${2:-./hubertfa-onnx-out}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?set R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?set R2_SECRET_ACCESS_KEY}"

if [[ ! -f "${ASSETS_DIR}/hubertfa_v007_fp32_webgpu.onnx" ]]; then
  echo "ERROR: ${ASSETS_DIR}/hubertfa_v007_fp32_webgpu.onnx not found. Run ./scripts/build-hubertfa-onnx.sh first." >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"

upload() {
  local name="$1" type="$2"
  echo "==> uploading ${name} ($(du -h "${ASSETS_DIR}/${name}" | cut -f1))"
  aws s3 cp "${ASSETS_DIR}/${name}" "s3://${BUCKET}/${name}" \
    --endpoint-url "${ENDPOINT}" \
    --content-type "${type}" \
    --cache-control 'public, max-age=31536000, immutable' \
    --no-progress
}

upload hubertfa_v007_fp32_webgpu.onnx application/octet-stream
upload hubertfa_v007_cmudict.txt 'text/plain; charset=utf-8'
upload HUBERTFA_LICENSE.txt 'text/plain; charset=utf-8'
upload HUBERTFA_NOTICE.txt 'text/plain; charset=utf-8'

# kuromoji's IPADIC dictionary, loaded only to read kanji in Japanese lyrics.
# Uploaded gzipped as-is (no Content-Encoding): the app decompresses it itself.
KUROMOJI_DIR="$(dirname "$0")/../node_modules/@sglkc/kuromoji"
for file in "${KUROMOJI_DIR}"/dict/*.dat.gz "${KUROMOJI_DIR}/NOTICE.md"; do
  name="kuromoji-ipadic/$(basename "${file}")"
  echo "==> uploading ${name}"
  aws s3 cp "${file}" "s3://${BUCKET}/${name}" \
    --endpoint-url "${ENDPOINT}" \
    --content-type application/octet-stream \
    --cache-control 'public, max-age=31536000, immutable' \
    --no-progress
done

echo ""
echo "Done. Verify, e.g.:"
echo "  curl -I https://models.composer.dacubeking.com/hubertfa_v007_fp32_webgpu.onnx"
