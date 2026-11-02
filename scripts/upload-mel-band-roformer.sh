#!/usr/bin/env bash
#
# Upload the Mel-Band RoFormer vocal model ("High quality vocals") and its notice
# to the R2 bucket that serves the HTDemucs model (VITE_VOCAL_MODEL_BASE_URL),
# under mel-band-roformer/. The bucket's CORS rules are set by
# ./scripts/upload-htdemucs.sh and cover these files too.
#
# The model is 14 ONNX graphs. The last is 403 MB, over wrangler's 300 MiB
# upload limit, so it is stored as two byte ranges (.001, .002) that the app
# joins. Every file's size and sha256 are pinned in
# src/audio/separation/roformer/model-parts.ts; this script checks them first,
# and never replaces an object that already exists (file names are versioned).
#
# Usage:
#   ./scripts/upload-mel-band-roformer.sh <bucket-name> <parts_dir>
#
# <parts_dir> holds mbr_kj_fp16_v1_part00.onnx ... part12.onnx and
# mbr_kj_fp16_v1_part13.onnx.001/.002 (split -n 2 -d -a 3 --numeric-suffixes=1).
# Requires wrangler logged in to the bucket's account (pnpm dlx wrangler login).

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <bucket-name> <parts_dir>" >&2
  exit 1
fi

BUCKET="$1"
PARTS_DIR="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PINS="${ROOT}/src/audio/separation/roformer/model-parts.ts"
NOTICE="${ROOT}/scripts/mel-band-roformer/MEL_BAND_ROFORMER_KJ_NOTICE.txt"
PREFIX="mel-band-roformer"

# name bytes sha256, read from the pinned table
mapfile -t PINNED < <(tr -d ' \n' <"${PINS}" | grep -oE 'name:"[^"]+",bytes:[0-9]+,sha256:"[0-9a-f]{64}"' |
  sed -E 's/name:"([^"]+)",bytes:([0-9]+),sha256:"([0-9a-f]+)"/\1 \2 \3/')
if [[ ${#PINNED[@]} -ne 15 ]]; then
  echo "ERROR: expected 15 pinned files in ${PINS}, found ${#PINNED[@]}" >&2
  exit 1
fi

for pin in "${PINNED[@]}"; do
  read -r name bytes sha <<<"${pin}"
  file="${PARTS_DIR}/${name}"
  [[ -f "${file}" ]] || { echo "ERROR: ${file} not found" >&2; exit 1; }
  [[ "$(stat -c %s "${file}")" == "${bytes}" ]] || { echo "ERROR: ${name} is not ${bytes} bytes" >&2; exit 1; }
  [[ "$(sha256sum "${file}" | cut -d' ' -f1)" == "${sha}" ]] || { echo "ERROR: ${name} sha256 mismatch" >&2; exit 1; }
done
echo "==> all 15 files match their pins"

exists() {
  pnpm dlx wrangler r2 object get --remote "${BUCKET}/$1" --pipe >/dev/null 2>&1
}

upload() {
  local file="$1" key="$2" type="$3"
  if exists "${key}"; then
    echo "skip: ${key} already exists"
    return
  fi
  echo "==> uploading ${key} ($(du -h "${file}" | cut -f1))"
  pnpm dlx wrangler r2 object put --remote "${BUCKET}/${key}" \
    --file="${file}" \
    --content-type="${type}" \
    --cache-control='public, max-age=31536000, immutable'
}

# The notice first: the app links to it as soon as the model is listed.
upload "${NOTICE}" "${PREFIX}/$(basename "${NOTICE}")" 'text/plain; charset=utf-8'
for pin in "${PINNED[@]}"; do
  read -r name _ _ <<<"${pin}"
  upload "${PARTS_DIR}/${name}" "${PREFIX}/${name}" application/octet-stream
done

echo ""
echo "Done. Check, e.g.:"
echo "  curl -I \"\${VITE_VOCAL_MODEL_BASE_URL}/${PREFIX}/mbr_kj_fp16_v1_part00.onnx\""
