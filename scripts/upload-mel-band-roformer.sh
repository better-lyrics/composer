#!/usr/bin/env bash
#
# Upload the Mel-Band RoFormer vocal model ("High quality vocals") and its notice
# to the R2 bucket that serves the HTDemucs model (VITE_VOCAL_MODEL_BASE_URL),
# under mel-band-roformer/. The bucket's CORS rules are set by
# ./scripts/upload-htdemucs.sh and cover these files too.
#
# The model is 14 ONNX graphs (scripts/mel-band-roformer/README.md builds them).
# The last is 385 MiB, over wrangler's 300 MiB upload limit, so this uploads
# through R2's S3 API with rclone, which sends large files in parts. Every
# file's size and sha256 are pinned in
# src/audio/separation/roformer/model-parts.ts; this script checks them first,
# and never replaces a model file that already exists (file names are
# versioned). The notice is always uploaded, with a one-hour cache, so
# corrections reach the app.
#
# Usage:
#   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
#     ./scripts/upload-mel-band-roformer.sh <bucket-name> <parts_dir>
#
# <parts_dir> holds mbr_kj_fp16_v1_part00.onnx ... part13.onnx. The keys are an
# R2 API token with Object Read & Write on the bucket (Cloudflare dashboard >
# R2 > Manage API tokens). Requires rclone (https://rclone.org/install/).

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <bucket-name> <parts_dir>" >&2
  exit 1
fi
: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID}" "${R2_ACCESS_KEY_ID:?set R2_ACCESS_KEY_ID}" "${R2_SECRET_ACCESS_KEY:?set R2_SECRET_ACCESS_KEY}"
command -v rclone >/dev/null || { echo "ERROR: rclone not found" >&2; exit 1; }

BUCKET="$1"
PARTS_DIR="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PINS="${ROOT}/src/audio/separation/roformer/model-parts.ts"
NOTICE="${ROOT}/scripts/mel-band-roformer/MEL_BAND_ROFORMER_KJ_NOTICE.txt"
PREFIX="mel-band-roformer"

# rclone reads the remote from the environment, so the keys never reach the command line.
export RCLONE_S3_PROVIDER=Cloudflare
export RCLONE_S3_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_S3_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export RCLONE_S3_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export RCLONE_S3_ENV_AUTH=false
export RCLONE_S3_NO_CHECK_BUCKET=true # an object-scoped token can't create or list buckets
DEST=":s3:${BUCKET}/${PREFIX}"

# name bytes sha256, read from the pinned table
mapfile -t PINNED < <(tr -d ' \n' <"${PINS}" | grep -oE 'name:"[^"]+",bytes:[0-9]+,sha256:"[0-9a-f]{64}"' |
  sed -E 's/name:"([^"]+)",bytes:([0-9]+),sha256:"([0-9a-f]+)"/\1 \2 \3/')
if [[ ${#PINNED[@]} -ne 14 ]]; then
  echo "ERROR: expected 14 pinned files in ${PINS}, found ${#PINNED[@]}" >&2
  exit 1
fi

for pin in "${PINNED[@]}"; do
  read -r name bytes sha <<<"${pin}"
  file="${PARTS_DIR}/${name}"
  [[ -f "${file}" ]] || { echo "ERROR: ${file} not found" >&2; exit 1; }
  [[ "$(stat -c %s "${file}")" == "${bytes}" ]] || { echo "ERROR: ${name} is not ${bytes} bytes" >&2; exit 1; }
  [[ "$(sha256sum "${file}" | cut -d' ' -f1)" == "${sha}" ]] || { echo "ERROR: ${name} sha256 mismatch" >&2; exit 1; }
done
echo "==> all 14 files match their pins"

upload() {
  local file="$1" type="$2" cache="$3"
  shift 3
  echo "==> ${PREFIX}/$(basename "${file}") ($(du -h "${file}" | cut -f1))"
  rclone copyto "${file}" "${DEST}/$(basename "${file}")" \
    --header-upload "Content-Type: ${type}" \
    --header-upload "Cache-Control: ${cache}" \
    --s3-chunk-size 64M "$@" -v
}

# The notice first: the app links to it as soon as the model is listed.
upload "${NOTICE}" 'text/plain; charset=utf-8' 'public, max-age=3600'
for pin in "${PINNED[@]}"; do
  read -r name _ _ <<<"${pin}"
  upload "${PARTS_DIR}/${name}" application/octet-stream "public, max-age=31536000, immutable" --ignore-existing
done

echo ""
echo "Done. Check, e.g.:"
echo "  curl -I \"\${VITE_VOCAL_MODEL_BASE_URL}/${PREFIX}/mbr_kj_fp16_v1_part13.onnx\""
