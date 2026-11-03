"""Build the 14 ONNX graphs Composer's "High quality vocals" separator runs, from Kimberley Jensen's checkpoint.

Usage: python export-onnx.py --msst DIR --ckpt MelBandRoformer.ckpt OUT_DIR [--check]

The graph covers band features -> masks. The STFT, band gather, mask averaging and inverse STFT run in JavaScript
(src/audio/separation/roformer/), and this script checks the band table there against the model's. Steps:

1. Trace the model's core to ONNX (fp32), with the time attention computed in 6 band groups, so the
   [480, 801, 801] score tensor (1.23 GB in fp32) never exists at once. Same numbers.
2. Fold constants with onnxruntime's basic optimisation level (no onnxruntime-specific fusions).
3. Rewrite the four 60-way Split/Concat nodes into trees of at most 8. onnxruntime-web's WebGPU EP binds one storage
   buffer per tensor and allows 16 per shader, so the 60-way nodes fail at run time.
4. Convert to mixed-precision fp16 with float32 I/O. The RMSNorm subgraphs stay fp32, because the sum of squares of
   the unnormalised STFT band features overflows fp16.
5. Cut the graph into 14 consecutive graphs: band split, each of the 12 transformers, mask estimator. One tensor
   crosses each cut. The app runs them as separate sessions and waits for the GPU after each, so onnxruntime-web
   reuses intermediate buffers instead of holding a whole forward pass (which runs out of memory under 7 GB).

--check runs the 14 graphs on onnxruntime's CPU EP and compares the masks with PyTorch's (slow: a few minutes).
"""

import argparse
import hashlib
import os
import re
import sys
import tempfile

import numpy as np
import onnx
import onnxruntime as ort
import torch
import yaml
from einops import pack, rearrange, unpack
from onnx import helper, numpy_helper
from onnxconverter_common import float16
from torch import nn

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_TS = os.path.join(ROOT, "src/audio/separation/roformer/spec.ts")
PINS_TS = os.path.join(ROOT, "src/audio/separation/roformer/model-parts.ts")

CKPT_SHA256 = "87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e"
CONFIG = "configs/KimberleyJensen/config_vocals_mel_band_roformer_kj.yaml"
PREFIX = "mbr_kj_fp16_v1"
SR, N_FFT, HOP, CHUNK = 44100, 2048, 441, 352_800
TIME_GROUPS = 6
TREE_WIDTH = 8


# -- Model --------------------------------------------------------------------


class _Loader(yaml.SafeLoader):
    pass


_Loader.add_constructor("tag:yaml.org,2002:python/tuple", lambda loader, node: tuple(loader.construct_sequence(node)))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def load_model(msst, ckpt):
    if sha256(ckpt) != CKPT_SHA256:
        sys.exit(f"{ckpt} isn't the pinned checkpoint (sha256 {CKPT_SHA256})")
    sys.path.insert(0, msst)
    from models.bs_roformer.mel_band_roformer import MelBandRoformer

    with open(os.path.join(msst, CONFIG)) as f:
        cfg = yaml.load(f, Loader=_Loader)
    model = MelBandRoformer(**cfg["model"])
    state = torch.load(ckpt, map_location="cpu", weights_only=False)
    model.load_state_dict(state.get("state_dict", state))
    return model.eval()


class GroupedAttend(nn.Module):
    """Scaled dot-product attention over the batch (band) axis in `groups` slices."""

    def __init__(self, groups):
        super().__init__()
        self.groups = groups

    def forward(self, q, k, v):
        sdpa = torch.nn.functional.scaled_dot_product_attention
        if self.groups <= 1:
            return sdpa(q, k, v)
        return torch.cat([sdpa(a, b, c) for a, b, c in zip(q.chunk(self.groups), k.chunk(self.groups), v.chunk(self.groups))])


class Core(nn.Module):
    """Band features [1, T, D] -> masks [1, T, D], D = 2 * len(freq_indices): the model minus STFT and iSTFT."""

    def __init__(self, m, time_groups=1):
        super().__init__()
        self.m = m
        for time_t, freq_t in m.layers:
            for attn, _ff in time_t.layers:
                attn.attend = GroupedAttend(time_groups)
            for attn, _ff in freq_t.layers:
                attn.attend = GroupedAttend(1)

    def forward(self, x):
        m = self.m
        x = m.band_split(x)
        for time_t, freq_t in m.layers:
            x = rearrange(x, "b t f d -> b f t d")
            x, ps = pack([x], "* t d")
            x = time_t(x)
            (x,) = unpack(x, ps, "* t d")
            x = rearrange(x, "b f t d -> b t f d")
            x, ps = pack([x], "* f d")
            x = freq_t(x)
            (x,) = unpack(x, ps, "* f d")
        return m.mask_estimators[0](x)


# -- The JavaScript side, as the reference ------------------------------------


def stft(chunk):
    """[2, CHUNK] -> complex [2 * bins, T], row = bin * 2 + channel."""
    z = torch.stft(torch.from_numpy(chunk), n_fft=N_FFT, hop_length=HOP, win_length=N_FFT,
                   window=torch.hann_window(N_FFT), center=True, normalized=False, return_complex=True)
    return rearrange(z, "s f t -> (f s) t").numpy()


def features(spec, freq_indices):
    g = spec[freq_indices]
    return np.ascontiguousarray(np.stack([g.real, g.imag], -1).transpose(1, 0, 2).reshape(1, g.shape[1], -1), np.float32)


def apply_masks(spec, masks, freq_indices, bands_per_freq):
    mk = masks[0].reshape(masks.shape[1], -1, 2)
    mk = (mk[..., 0] + 1j * mk[..., 1]).T
    summed = np.zeros(spec.shape, np.complex64)
    np.add.at(summed, freq_indices, mk)
    est = spec * (summed / np.maximum(np.repeat(bands_per_freq, 2)[:, None], 1e-8))
    est = rearrange(est, "(f s) t -> s f t", s=2).copy()
    est[:, 0] = 0
    return torch.istft(torch.from_numpy(est), n_fft=N_FFT, hop_length=HOP, win_length=N_FFT,
                       window=torch.hann_window(N_FFT), center=True, normalized=False).numpy()


def snr(ref, est):
    ref = ref.astype(np.float64)
    return float(10 * np.log10(np.sum(ref**2) / max(np.sum((ref - est) ** 2), 1e-30)))


def check_band_table(m):
    """The model's bands must be the inclusive bin ranges in spec.ts, in order."""
    bins = (m.freq_indices.numpy()[::2] // 2).tolist()  # rows are bin * 2 + channel
    model_bands, at = [], 0
    for n in m.num_freqs_per_band.tolist():
        band = bins[at:at + n]
        assert band == list(range(band[0], band[-1] + 1)), "a band isn't a contiguous bin range"
        model_bands.append((band[0], band[-1]))
        at += n
    with open(SPEC_TS) as f:
        table = re.search(r"MEL_BAND_BINS[^=]*=\s*\[(.*?)\];", f.read(), re.S).group(1)
    js_bands = [(int(a), int(b)) for a, b in re.findall(r"\[(\d+),\s*(\d+)\]", table)]
    if js_bands != model_bands:
        sys.exit(f"spec.ts MEL_BAND_BINS doesn't match the model's {len(model_bands)} bands")
    print(f"band table: {len(model_bands)} bands match spec.ts")


# -- Graph passes -------------------------------------------------------------


def export(core, x, dst):
    tmp = dst + ".tmp"
    with torch.no_grad():
        torch.onnx.export(core, (torch.from_numpy(x),), tmp, input_names=["features"], output_names=["masks"],
                          opset_version=17, dynamo=False, do_constant_folding=True)
    onnx.save_model(onnx.load(tmp), dst, save_as_external_data=False)
    for f in os.listdir(os.path.dirname(dst)):
        if f.startswith(os.path.basename(tmp)):
            os.remove(os.path.join(os.path.dirname(dst), f))


def fold(src, dst):
    so = ort.SessionOptions()
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    so.optimized_model_filepath = dst + ".tmp"
    so.add_session_config_entry("session.optimized_model_external_initializers_file_name",
                                os.path.basename(dst) + ".tmp.data")
    so.add_session_config_entry("session.optimized_model_external_initializers_min_size_in_bytes", "1024")
    ort.InferenceSession(src, so, providers=["CPUExecutionProvider"])
    onnx.save_model(onnx.load(dst + ".tmp"), dst, save_as_external_data=False)
    os.remove(dst + ".tmp")
    os.remove(dst + ".tmp.data")


def narrow_split_concat(src, dst):
    m = onnx.load(src)
    g = m.graph
    inits = {i.name: i for i in g.initializer}
    new_nodes, uid = [], [0]

    def name(p):
        uid[0] += 1
        return f"{p}_tree{uid[0]}"

    def groups(n):
        return [list(range(i, min(i + TREE_WIDTH, n))) for i in range(0, n, TREE_WIDTH)]

    for node in g.node:
        axis = next((a.i for a in node.attribute if a.name == "axis"), 0)
        if node.op_type == "Concat" and len(node.input) > TREE_WIDTH:
            mids = []
            for grp in groups(len(node.input)):
                if len(grp) == 1:
                    mids.append(node.input[grp[0]])
                    continue
                o = name(node.name)
                mids.append(o)
                new_nodes.append(helper.make_node("Concat", [node.input[i] for i in grp], [o], name=o, axis=axis))
            new_nodes.append(helper.make_node("Concat", mids, list(node.output), name=node.name, axis=axis))
        elif node.op_type == "Split" and len(node.output) > TREE_WIDTH:
            sizes = numpy_helper.to_array(inits[node.input[1]]).astype(np.int64)
            gs = groups(len(node.output))
            tname = name(node.name + "_sizes")
            g.initializer.append(numpy_helper.from_array(np.array([sizes[grp].sum() for grp in gs], np.int64), tname))
            mids = [name(node.name) for _ in gs]
            new_nodes.append(helper.make_node("Split", [node.input[0], tname], mids, name=name(node.name), axis=axis))
            for mid, grp in zip(mids, gs):
                if len(grp) == 1:
                    new_nodes.append(helper.make_node("Identity", [mid], [node.output[grp[0]]], name=name(node.name)))
                    continue
                sname = name(node.name + "_sizes")
                g.initializer.append(numpy_helper.from_array(sizes[grp], sname))
                new_nodes.append(helper.make_node("Split", [mid, sname], [node.output[i] for i in grp],
                                                  name=name(node.name), axis=axis))
        else:
            new_nodes.append(node)
    del g.node[:]
    g.node.extend(new_nodes)
    onnx.checker.check_model(m, full_check=False)
    onnx.save_model(m, dst, save_as_external_data=False)


def to_fp16(src, dst):
    m = onnx.load(src)
    norm = [n.name for n in m.graph.node
            if n.op_type in ("ReduceL2", "Clip", "Expand", "Div") and "/net.2/" not in n.name]  # not the GELU's Div
    fp16 = float16.convert_float_to_float16(m, keep_io_types=True, op_block_list=float16.DEFAULT_OP_BLOCK_LIST,
                                            node_block_list=norm)
    onnx.save_model(fp16, dst, save_as_external_data=False)


def split_graph(src, out_dir):
    m = onnx.load(src)
    inferred = onnx.shape_inference.infer_shapes(onnx.ModelProto.FromString(m.SerializeToString()), strict_mode=False)
    vi = {v.name: v for v in list(inferred.graph.value_info) + list(inferred.graph.input) + list(inferred.graph.output)}
    nodes = list(m.graph.node)
    inits = {i.name: i for i in m.graph.initializer}

    def module(n):
        r = re.match(r"/(?:m/)?(layers\.\d+\.\d+|mask_estimators|band_split)", n.name)
        return r.group(1) if r else None

    # Each graph starts at its module's first node; unnamed nodes stay with the module before them.
    starts, seen = [], []
    for i, n in enumerate(nodes):
        k = module(n)
        if k and k not in seen:
            seen.append(k)
            starts.append(i)
    starts[0] = 0
    cuts = sorted(set(starts + [len(nodes)]))
    consumers = {}
    for i, n in enumerate(nodes):
        for x in n.input:
            consumers.setdefault(x, []).append(i)
    graph_outputs = {o.name for o in m.graph.output}
    paths = []
    for p, (a, b) in enumerate(zip(cuts[:-1], cuts[1:])):
        seg = nodes[a:b]
        produced = {o for n in seg for o in n.output}
        ins, used_inits = [], []
        for n in seg:
            for x in n.input:
                if not x or x in produced or x in ins:
                    continue
                if x in inits:
                    if x not in used_inits:
                        used_inits.append(x)
                else:
                    ins.append(x)
        outs = [o for n in seg for o in n.output if o in graph_outputs or any(c >= b for c in consumers.get(o, []))]
        if len(ins) != 1 or len(outs) != 1:
            sys.exit(f"graph {p} has inputs {ins} and outputs {outs}; the app passes exactly one tensor between graphs")
        g = helper.make_graph(seg, f"part{p}", [vi[x] for x in ins], [vi[o] for o in outs], [inits[x] for x in used_inits])
        pm = helper.make_model(g, opset_imports=m.opset_import, producer_name="split_model")
        pm.ir_version = m.ir_version
        path = os.path.join(out_dir, f"{PREFIX}_part{p:02d}.onnx")
        onnx.save_model(pm, path, save_as_external_data=False)
        paths.append(path)
    return paths


# -- Checks -------------------------------------------------------------------


def check_parts(paths, x, ref):
    so = ort.SessionOptions()
    so.enable_cpu_mem_arena = False
    y = x
    for path in paths:
        s = ort.InferenceSession(path, so, providers=["CPUExecutionProvider"])
        y = s.run(None, {s.get_inputs()[0].name: y})[0]
        del s
    print(f"onnxruntime CPU, 14 graphs vs PyTorch: mask SNR {snr(ref, y):.1f} dB, max abs {np.abs(y - ref).max():.3g}")


def compare_pins(paths):
    with open(PINS_TS) as f:
        pins = dict(re.findall(r'name: "([^"]+)",\s*bytes: \d+,\s*sha256: "([0-9a-f]{64})"', f.read()))
    same = 0
    for path in paths:
        name, digest = os.path.basename(path), sha256(path)
        match = pins.get(name) == digest
        same += match
        print(f"  {name}  {os.path.getsize(path):>10,}  {digest}  {'matches its pin' if match else 'differs from its pin'}")
    print(f"{same} of {len(paths)} graphs are byte-identical to the hosted files")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--msst", required=True, help="ZFTurbo/Music-Source-Separation-Training checkout")
    ap.add_argument("--ckpt", required=True, help="MelBandRoformer.ckpt")
    ap.add_argument("--check", action="store_true", help="also run the graphs on onnxruntime's CPU EP")
    ap.add_argument("out_dir")
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    m = load_model(args.msst, args.ckpt)
    check_band_table(m)
    fi = m.freq_indices.numpy().astype(np.int64)
    bpf = m.num_bands_per_freq.numpy().astype(np.float32)

    # Any 8 s stereo signal works for tracing; seeded noise keeps the build free of copyrighted audio.
    chunk = (np.random.default_rng(0).standard_normal((2, CHUNK)) * 0.1).astype(np.float32)
    spec = stft(chunk)
    x = features(spec, fi)
    core = Core(m, TIME_GROUPS).eval()

    with tempfile.TemporaryDirectory(dir=args.out_dir) as work:
        steps = [os.path.join(work, f) for f in ("fp32.onnx", "folded.onnx", "narrow.onnx", "fp16.onnx")]
        # Trace before any other forward pass: the rotary embeddings cache their tables on the first call, and a
        # trace through the cache records a different graph.
        print("1/5 tracing (a few minutes)", flush=True)
        export(core, x, steps[0])
        print("2/5 folding constants", flush=True)
        fold(steps[0], steps[1])
        os.remove(steps[0])
        print("3/5 narrowing Split/Concat", flush=True)
        narrow_split_concat(steps[1], steps[2])
        os.remove(steps[1])
        print("4/5 converting to fp16", flush=True)
        to_fp16(steps[2], steps[3])
        os.remove(steps[2])
        print("5/5 cutting into graphs", flush=True)
        paths = split_graph(steps[3], args.out_dir)
        print(f"{len(paths)} graphs, {len(onnx.load(steps[3], load_external_data=False).graph.node)} nodes")

    with torch.no_grad():
        ref_wave = m(torch.from_numpy(chunk)[None])[0].numpy()
        ref_masks = core(torch.from_numpy(x)).numpy()
    split_wave = apply_masks(spec, ref_masks, fi, bpf)
    print(f"core + JS-side steps vs model.forward: {snr(ref_wave, split_wave):.1f} dB, max abs "
          f"{np.abs(ref_wave - split_wave).max():.3g}")
    compare_pins(paths)
    if args.check:
        check_parts(paths, x, ref_masks)


if __name__ == "__main__":
    main()
