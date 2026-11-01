# Beat This! model for the beat grid

Composer finds beats with [Beat This!](https://github.com/CPJKU/beat_this) (Foscarin, Schlüter and Widmer, ISMIR 2024). The code and the weights are MIT licensed. Composer uses the `small0` checkpoint, exported to ONNX, and runs it in the browser with onnxruntime-web.

## Setup

```bash
uv venv /tmp/bt-run --python 3.12
uv pip install --python /tmp/bt-run/bin/python \
  "beat_this @ git+https://github.com/CPJKU/beat_this@b95c8ab0c58c2d9fcfd40508ae8dffbc05ac4f5c" \
  soxr soundfile torch torchaudio onnx onnxruntime
```

## Export

```bash
/tmp/bt-run/bin/python scripts/beat-this/export-onnx.py beat_this_small0_v1.onnx
```

The script checks the export against PyTorch and prints the size and SHA-256. The hosted `_v1` file is 9,428,394 bytes, SHA-256 `5e44ae9e35dc9d9d5b7ea3e780787a2718ab720da72ab8763708b3ebbc91944b`. A fresh export computes the same outputs but its bytes differ (graph node names and PyTorch version), so upload it under a new name.

## Upload

The app loads the model from `https://models.betterlyrics.org/composer/`, set in `src/audio/beat/beat-model.ts`. A new export gets a new file name (`_v2`), because the app caches by URL.

```bash
pnpm dlx wrangler r2 object put --remote models/composer/beat_this_small0_v1.onnx \
  --file=beat_this_small0_v1.onnx \
  --content-type=application/octet-stream \
  --cache-control='public, max-age=31536000, immutable'
```

The bucket must allow GET from the app origins and expose `Content-Length`, which the download progress needs.

## Test fixtures

`make-fixtures.py` writes `src/audio/beat/test-fixtures/`. The tests compare the TypeScript front end and peak picking against them.

```bash
/tmp/bt-run/bin/python scripts/beat-this/make-fixtures.py src/audio/beat/test-fixtures <GOT DAMN as mono 22050 Hz float32>
```
