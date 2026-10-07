#!/usr/bin/env bash
#
# Build the HubertFA forced-alignment assets for Composer's Auto-align.
#
# Pipeline:
#   1. Downloads the HubertFA v0.0.7 release (Apache-2.0) and checks its hash.
#   2. Removes the graph's two fp32 -> fp16 -> fp32 Cast round-trips. They only
#      drop precision, and WebGPU can't run fp16 casts without shader-f16, which
#      many GPUs lack. Weights stay fp32 for the same reason.
#   3. Copies the English dictionary and the licences next to it.
#
# Usage:
#   ./scripts/build-hubertfa-onnx.sh [output_dir]
#
# Then upload with ./scripts/upload-hubertfa.sh <bucket-name> [output_dir].

set -euo pipefail

OUT_DIR="${1:-./hubertfa-onnx-out}"
WORK_DIR="${WORK_DIR:-/tmp/composer-hubertfa-build}"
RELEASE_URL="https://github.com/wolfgitpr/HubertFA/releases/download/v0.0.7/1218_hfa_model_new_dict.zip"
RELEASE_SHA256="48bd6dbcc293e47cc6cbcc556baf575e3d91d61d0ac88ddeccd6098f8f346fa2"
LICENSE_URL="https://raw.githubusercontent.com/wolfgitpr/HubertFA/main/LICENSE"

mkdir -p "${OUT_DIR}" "${WORK_DIR}"

if [[ ! -f "${WORK_DIR}/release.zip" ]]; then
  echo "==> downloading HubertFA v0.0.7"
  curl -fL "${RELEASE_URL}" -o "${WORK_DIR}/release.zip"
fi
echo "${RELEASE_SHA256}  ${WORK_DIR}/release.zip" | sha256sum -c -
unzip -oq "${WORK_DIR}/release.zip" -d "${WORK_DIR}/release"
MODEL_DIR="$(dirname "$(find "${WORK_DIR}/release" -name model.onnx | head -1)")"

if [[ ! -d "${WORK_DIR}/venv" ]]; then
  python3 -m venv "${WORK_DIR}/venv"
  "${WORK_DIR}/venv/bin/pip" install -q onnx
fi

echo "==> removing fp32 -> fp16 -> fp32 Cast round-trips"
"${WORK_DIR}/venv/bin/python" - "${MODEL_DIR}/model.onnx" "${OUT_DIR}/hubertfa_v007_fp32_webgpu.onnx" <<'PY'
import sys
import onnx
from onnx import TensorProto

src, dst = sys.argv[1], sys.argv[2]
model = onnx.load(src)
graph = model.graph
cast_to = lambda node: next(a.i for a in node.attribute if a.name == "to")
producer = {out: node for node in graph.node for out in node.output}
removed, rewired = set(), {}
for node in graph.node:
    if node.op_type == "Cast" and cast_to(node) == TensorProto.FLOAT:
        first = producer.get(node.input[0])
        if first is not None and first.op_type == "Cast" and cast_to(first) == TensorProto.FLOAT16:
            removed.update([first.name, node.name])
            rewired[node.output[0]] = first.input[0]
kept = [node for node in graph.node if node.name not in removed]
for node in kept:
    for i, name in enumerate(node.input):
        node.input[i] = rewired.get(name, name)
del graph.node[:]
graph.node.extend(kept)
assert not [n for n in graph.node if n.op_type == "Cast" and cast_to(n) == TensorProto.FLOAT16]
onnx.save(model, dst)
print(f"removed {len(removed) // 2} Cast round-trips")
PY

cp "${MODEL_DIR}/ds_cmudict-07b.txt" "${OUT_DIR}/hubertfa_v007_cmudict.txt"
curl -fsSL "${LICENSE_URL}" -o "${OUT_DIR}/HUBERTFA_LICENSE.txt"
cat > "${OUT_DIR}/HUBERTFA_NOTICE.txt" <<'TXT'
hubertfa_v007_fp32_webgpu.onnx is HubertFA v0.0.7's model.onnx
(https://github.com/wolfgitpr/HubertFA, Apache-2.0; see HUBERTFA_LICENSE.txt).
Modification: two float32 -> float16 -> float32 Cast round-trips were removed from the graph.
It embeds the chinese-hubert-base encoder (https://huggingface.co/TencentGameMate/chinese-hubert-base, MIT).
hubertfa_v007_cmudict.txt is HubertFA's ds_cmudict-07b.txt, derived from the CMU Pronouncing Dictionary (BSD-style licence).
TXT

echo ""
sha256sum "${OUT_DIR}"/hubertfa_v007_*
ls -la "${OUT_DIR}"
