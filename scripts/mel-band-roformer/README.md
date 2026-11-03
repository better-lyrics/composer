# Mel-Band RoFormer for "High quality vocals"

Settings > Models > Vocal model > "High quality vocals" runs Kimberley Jensen's [Mel-Band RoFormer vocal model](https://huggingface.co/KimberleyJSN/melbandroformer) (MIT) in the browser with onnxruntime-web on WebGPU. The model code and config come from [ZFTurbo/Music-Source-Separation-Training](https://github.com/ZFTurbo/Music-Source-Separation-Training) (MIT). `MEL_BAND_ROFORMER_KJ_NOTICE.txt` is the notice the app links to.

The ONNX graphs cover band features to masks. The STFT, band gather, mask averaging and inverse STFT run in JavaScript (`src/audio/separation/roformer/`). The model is cut into 14 graphs that the app runs as separate sessions, waiting for the GPU after each: the band split, the 12 transformers and the mask estimator. As one graph it runs out of memory under 7 GB, because onnxruntime-web holds a whole forward pass's intermediate buffers until the GPU catches up. `export-onnx.py`'s docstring lists every step.

## Setup

About 4 GB of RAM and 3 GB of disk. No GPU needed.

```bash
uv venv /tmp/mbr-venv --python 3.12
uv pip install --python /tmp/mbr-venv/bin/python \
  --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match \
  torch==2.15.0 onnx==1.23.2 onnxruntime==1.31.1 onnxconverter-common==1.16.0 onnxscript==0.7.2 \
  numpy==2.5.4 einops==0.8.2 pyyaml==6.0.3 beartype==0.23.1 rotary-embedding-torch==0.9.1 librosa==1.0.0

git clone https://github.com/ZFTurbo/Music-Source-Separation-Training /tmp/msst
git -C /tmp/msst checkout 9cc76c03ccd4da5ddf3477e93d386a1648a77732

curl -L -o /tmp/MelBandRoformer.ckpt \
  https://huggingface.co/KimberleyJSN/melbandroformer/resolve/ac9b0614ab3cd7f77219e18ba494dfd93956c348/MelBandRoformer.ckpt
```

## Export

```bash
/tmp/mbr-venv/bin/python scripts/mel-band-roformer/export-onnx.py \
  --msst /tmp/msst --ckpt /tmp/MelBandRoformer.ckpt ./mel-band-roformer-parts
```

It takes about 10 minutes. The script checks the checkpoint's SHA-256 and that `MEL_BAND_BINS` in `spec.ts` matches the model's bands. It then checks the model's core plus the JavaScript-side steps against the untouched PyTorch model, and compares each graph's SHA-256 with the pins in `src/audio/separation/roformer/model-parts.ts`. With the versions above the output is byte-identical to the hosted `_v1` files. `--check` also runs the 14 graphs on onnxruntime's CPU EP against PyTorch, which takes a few more minutes.

## Upload

A new export, or one that differs from the pins, gets a new name (`_v2`) and new pins, because the app caches by URL. The upload goes through R2's S3 API, because the mask estimator graph (385 MiB) is over wrangler's 300 MiB upload limit:

```bash
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
  ./scripts/upload-mel-band-roformer.sh composer-vocal-models ./mel-band-roformer-parts
```

The script checks every file against its pin and never replaces a model file that already exists.
