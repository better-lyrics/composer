"""Export Beat This! small0 to ONNX for Composer's beat grid.

Usage: python scripts/beat-this/export-onnx.py [output.onnx]
"""

import hashlib
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from beat_this.inference import load_model

CHECKPOINT = "small0"
PARITY_FRAMES = (251, 1500, 3000)
PARITY_TOLERANCE = 1e-3


class BeatLogits(torch.nn.Module):
    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.model = model

    def forward(self, spect: torch.Tensor):
        out = self.model(spect)
        return out["beat"], out["downbeat"]


def main() -> None:
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "beat_this_small0_v1.onnx")
    model = load_model(CHECKPOINT, "cpu")
    # A cached rotary table would be baked into the graph at the traced length.
    for module in model.modules():
        if hasattr(module, "cache_if_possible"):
            module.cache_if_possible = False
    wrapper = BeatLogits(model).eval()

    # The dynamo exporter fails on this model ("expected compiled_fn to be GraphModule").
    torch.onnx.export(
        wrapper,
        (torch.randn(1, 1500, 128),),
        str(output),
        dynamo=False,
        opset_version=17,
        input_names=["spect"],
        output_names=["beat", "downbeat"],
        dynamic_axes={"spect": {1: "frames"}, "beat": {1: "frames"}, "downbeat": {1: "frames"}},
    )

    session = ort.InferenceSession(str(output), providers=["CPUExecutionProvider"])
    for frames in PARITY_FRAMES:
        spect = torch.randn(1, frames, 128)
        with torch.inference_mode():
            expected = model(spect)
        beat, downbeat = session.run(None, {"spect": spect.numpy()})
        error = max(
            float(np.abs(beat - expected["beat"].numpy()).max()),
            float(np.abs(downbeat - expected["downbeat"].numpy()).max()),
        )
        assert error < PARITY_TOLERANCE, f"{frames} frames: max error {error}"
        print(f"parity at {frames} frames: max error {error:.2e}")

    data = output.read_bytes()
    print(f"{output}: {len(data)} bytes, sha256 {hashlib.sha256(data).hexdigest()}")


if __name__ == "__main__":
    main()
