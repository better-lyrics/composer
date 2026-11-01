"""Convert the fp32 HTDemucs ONNX export to the mixed-precision model Composer ships as fp16.

Usage: python scripts/convert-htdemucs-fp16.py htdemucs_fp32.onnx htdemucs_fp16_v2.onnx

A whole-graph fp16 conversion runs fine on onnxruntime's CPU EP, which quietly upcasts most fp16
ops, but onnxruntime-web 1.30's WebGPU EP computes them in fp16:

- HTDemucs normalises each segment by its mean and std. Those ReduceMeans span 2 x 343980 and
  4 x 2048 x 336 elements, and the fp16 sum overflows, so every output is NaN. The four
  ReduceMeans and the ops around them (the first 20 nodes) stay fp32.
- The fp16 ConvTranspose decoder layers alone cost ~23 dB of vocals SNR against fp32, so those
  8 nodes stay fp32 too.

Everything else, including every weight, is fp16. On an Intel Gen9 WebGPU adapter this is ~47 dB
vocals SNR against the fp32 model and 1.6x faster. Keeping every Conv in fp32 as well only reaches
~50 dB, at 1.3x. Recheck both numbers after an onnxruntime-web upgrade: they depend on its shaders.
"""

import sys

import onnx
from onnxconverter_common import float16

NORMALISATION_NODES = 20
FP32_OPS = ["ConvTranspose"]


def main(src: str, dst: str) -> None:
    model = onnx.load(src)
    head = model.graph.node[:NORMALISATION_NODES]
    if [n.op_type for n in head].count("ReduceMean") != 4 or model.graph.node[NORMALISATION_NODES].op_type != "Conv":
        sys.exit("unexpected graph layout: the input normalisation is not the first 20 nodes")
    fp16 = float16.convert_float_to_float16(
        model,
        keep_io_types=True,  # float32 I/O, so the worker feeds and reads the same tensors for both variants
        op_block_list=float16.DEFAULT_OP_BLOCK_LIST + FP32_OPS,
        node_block_list=[n.name for n in head],
    )
    onnx.save_model(fp16, dst, save_as_external_data=False)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
