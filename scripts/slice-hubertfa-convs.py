"""Split the HuBERT encoder's longest WebGPU dispatches in a HubertFA graph into short ones.

Usage: python scripts/slice-hubertfa-convs.py in.onnx out.onnx [--slices N] [--check]

i915 resets an Intel Gen9 iGPU's context when it can't preempt it within 640 ms, and the GPU
switches contexts only between dispatches. At a 15 s window on a UHD 630, two Convs each run
~650 ms as one dispatch: feature_extractor/conv_layers.1 and the positional conv. While either
runs, any other GPU client (the compositor redrawing, another tab) makes i915 reset the context,
and the WebGPU device is lost.

Both rewrites are exact:
- The seven feature-extractor Convs each run as N Convs over time slices of the input, each
  producing a run of output frames, concatenated in time. The bounds are computed in the graph
  from the input length, so any window length works. Only the Convs are sliced: conv_layers.0's
  GroupNorm (an InstanceNormalization over time in the graph) still sees the whole sequence. When
  a layer has fewer output frames than slices (a short window), an empty slice still runs its
  Conv over one frame, then keeps zero of them.
- The positional Conv (16 groups) runs as one ungrouped Conv per group, concatenated on channels.
  ORT-web's ungrouped Conv is also faster than its grouped one, which more than pays for the
  extra dispatches.

--check runs both graphs on onnxruntime's CPU EP on seeded synthetic audio and fails if any
output differs by more than float rounding.

Applies to any graph with HubertFA v0.0.7's encoder (chinese-hubert-base), such as the release
graph and checkpoints fine-tuned from it.
"""

import argparse
import sys

import numpy as np
import onnx
from onnx import helper, numpy_helper

FEATURE_CONVS = 7
SAMPLE_RATE = 44100
# Relative to the output's largest magnitude. A slicing mistake misplaces whole frames: an O(1) error.
CHECK_TOLERANCE = 1e-4


def attrs(node):
    return {a.name: helper.get_attribute_value(a) for a in node.attribute}


def find_convs(graph):
    weights = {i.name for i in graph.initializer}
    feature, positional = [], []
    for node in graph.node:
        if node.op_type != "Conv" or node.input[1] not in weights:
            continue
        a = attrs(node)
        if a.get("group", 1) > 1 and "pos_conv" in node.name:
            positional.append(node)
        elif (
            "feature_extractor" in node.name
            and a.get("group", 1) == 1
            and set(a.get("pads", [0])) == {0}
            and set(a.get("dilations", [1])) == {1}
        ):
            feature.append(node)
    if len(feature) != FEATURE_CONVS or len(positional) != 1:
        found = [n.name for n in feature + positional]
        sys.exit(f"expected {FEATURE_CONVS} feature-extractor Convs and one positional Conv, found {found}")
    return feature, positional[0]


class Builder:
    """Collects the nodes and initializers that replace one Conv, named under that Conv."""

    def __init__(self, prefix):
        self.prefix, self.nodes, self.consts = prefix, [], []

    def const(self, name, value):
        self.consts.append(numpy_helper.from_array(np.asarray(value), f"{self.prefix}/{name}"))
        return f"{self.prefix}/{name}"

    def i64(self, name, value):
        return self.const(name, np.array([value], np.int64))

    def op(self, kind, inputs, name, output=None, **kw):
        out = output or f"{self.prefix}/{name}"
        self.nodes.append(helper.make_node(kind, inputs, [out], name=f"{self.prefix}/{name}", **kw))
        return out


def slice_in_time(conv, n):
    a = attrs(conv)
    k, s = a["kernel_shape"][0], a["strides"][0]
    x, b = conv.input[0], Builder(conv.name)
    axis, zero, one = b.i64("axis", 2), b.i64("zero", 0), b.i64("one", 1)
    c_k, c_s, c_n = b.i64("k", k), b.i64("s", s), b.i64("n", n)
    length = b.op("Shape", [x], "length", start=2, end=3)
    # Output frames: floor((L - k) / s) + 1. Every operand is non-negative, so Div floors.
    frames = b.op("Add", [b.op("Div", [b.op("Sub", [length, c_k], "lk"), c_s], "lks"), one], "frames")
    bounds = [zero]
    bounds += [b.op("Div", [b.op("Mul", [frames, b.i64(f"i{i}", i)], f"ti{i}"), c_n], f"b{i}") for i in range(1, n)]
    bounds.append(frames)
    parts = []
    for i in range(n):
        lo, hi = bounds[i], bounds[i + 1]
        # At least one frame, so the Conv's input is never shorter than its kernel.
        hi1 = b.op("Max", [hi, b.op("Add", [lo, one], f"lo1_{i}")], f"hi1_{i}")
        start = b.op("Mul", [lo, c_s], f"start{i}")
        end = b.op("Add", [b.op("Mul", [b.op("Sub", [hi1, one], f"hm{i}"), c_s], f"hms{i}"), c_k], f"end{i}")
        xi = b.op("Slice", [x, start, end, axis], f"x{i}")
        yi = b.op("Conv", [xi, *conv.input[1:]], f"conv{i}", **a)
        parts.append(b.op("Slice", [yi, zero, b.op("Sub", [hi, lo], f"keep{i}"), axis], f"y{i}"))
    b.op("Concat", parts, "concat", output=conv.output[0], axis=2)
    return b


def split_groups(conv, weights):
    a = attrs(conv)
    groups = a.pop("group")
    w = numpy_helper.to_array(weights[conv.input[1]])
    bias = numpy_helper.to_array(weights[conv.input[2]]) if len(conv.input) > 2 else None
    out_per, in_per = w.shape[0] // groups, w.shape[1]
    b = Builder(conv.name)
    axis = b.i64("axis", 1)
    parts = []
    for j in range(groups):
        xj = b.op("Slice", [conv.input[0], b.i64(f"lo{j}", j * in_per), b.i64(f"hi{j}", (j + 1) * in_per), axis], f"x{j}")
        inputs = [xj, b.const(f"w{j}", w[j * out_per : (j + 1) * out_per])]
        if bias is not None:
            inputs.append(b.const(f"b{j}", bias[j * out_per : (j + 1) * out_per]))
        parts.append(b.op("Conv", inputs, f"conv{j}", **a))
    b.op("Concat", parts, "concat", output=conv.output[0], axis=1)
    return b


def rewrite(model, n):
    graph = model.graph
    feature, positional = find_convs(graph)
    weights = {i.name: i for i in graph.initializer}
    replace = {c.name: slice_in_time(c, n) for c in feature}
    replace[positional.name] = split_groups(positional, weights)
    nodes = []
    for node in graph.node:
        nodes.extend(replace[node.name].nodes if node.name in replace else [node])
    del graph.node[:]
    graph.node.extend(nodes)
    for b in replace.values():
        graph.initializer.extend(b.consts)
    used = {x for node in graph.node for x in node.input}
    for init in [i for i in graph.initializer if i.name not in used]:
        graph.initializer.remove(init)
    return model


def audio(seconds, seed):
    n = round(seconds * SAMPLE_RATE)
    if seed < 0:
        return np.zeros((1, n), np.float32)
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SAMPLE_RATE
    f = 150 + 200 * rng.random() + 50 * np.sin(2 * np.pi * 0.3 * t)
    phase = 2 * np.pi * np.cumsum(f) / SAMPLE_RATE
    tone = sum(np.sin(h * phase) / h for h in range(1, 7)) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.7 * t))
    return (0.25 * tone + 0.02 * rng.standard_normal(n))[None].astype(np.float32)


def check(src, dst):
    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    ref = ort.InferenceSession(src, opts, providers=["CPUExecutionProvider"])
    new = ort.InferenceSession(dst, opts, providers=["CPUExecutionProvider"])
    names = [o.name for o in ref.get_outputs()]
    worst_abs = worst_rel = 0.0
    cases = [(0.1, 1), (0.3, 2), (1.0, 3), (4.04, 4), (9.3, 5), (15.0, 6), (15.01, 7), (0.3, -1), (15.0, -1)]
    for seconds, seed in cases:
        feed = {"waveform": audio(seconds, seed)}
        for name, r, g in zip(names, ref.run(names, feed), new.run(names, feed)):
            if r.shape != g.shape:
                sys.exit(f"{seconds} s {name}: shape {g.shape} != {r.shape}")
            diff = float(np.abs(r.astype(np.float64) - g).max())
            rel = diff / max(float(np.abs(r).max()), 1e-6)
            worst_abs, worst_rel = max(worst_abs, diff), max(worst_rel, rel)
            label = "silence" if seed < 0 else f"seed {seed}"
            print(f"{seconds:6.2f} s {label:8s} {name:16s} max |ref| {np.abs(r).max():6.3g}  max abs diff {diff:.2g} ({rel:.2g} relative)")
    print(f"worst max abs diff {worst_abs:.2g}, worst relative {worst_rel:.2g}")
    if worst_rel > CHECK_TOLERANCE:
        sys.exit(f"rewritten graph differs from the original by {worst_rel:.2g} relative (> {CHECK_TOLERANCE})")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("src")
    parser.add_argument("dst")
    # 8 keeps each conv_layers.1 slice under ~100 ms on a UHD 630; past that, other kernels are the longest.
    parser.add_argument("--slices", type=int, default=8)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    model = rewrite(onnx.load(args.src), args.slices)
    onnx.checker.check_model(model)
    onnx.save(model, args.dst)
    print(f"sliced {FEATURE_CONVS} feature-extractor Convs into {args.slices} each; split the positional Conv by group")
    if args.check:
        check(args.src, args.dst)


if __name__ == "__main__":
    main()
