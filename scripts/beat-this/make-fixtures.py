"""Writes the beat detection test fixtures. Run with the beat_this venv."""
import json, sys, numpy as np, torch
from beat_this.inference import Audio2Frames, split_piece
from beat_this.model.postprocessor import Postprocessor
from beat_this.preprocessing import LogMelSpect
out_dir = sys.argv[1]
sr = 22050
n = np.arange(sr, dtype=np.float64)
signal = 0.5 * np.sin(2 * np.pi * 440 * n / sr) + 0.3 * np.sin(2 * np.pi * (100 + 2000 * n / sr) * n / sr)
signal[::11025] += 0.9
signal = signal.astype(np.float32)
mel = LogMelSpect()(torch.tensor(signal)).numpy()
json.dump({"signal": "0.5*sin(2*pi*440*n/sr) + 0.3*sin(2*pi*(100+2000*n/sr)*n/sr), +0.9 at every 11025th sample, n < 22050, float32",
           "frames": int(mel.shape[0]), "mel": [[round(float(v), 6) for v in row] for row in mel]},
          open(f"{out_dir}/mel-reference.json", "w"))
clip = np.fromfile(sys.argv[2], dtype=np.float32)[sr * 40: sr * 40 + sr * 31]
a2f = Audio2Frames("small0", "cpu")
b, d = a2f.spect2frames(a2f.spect(torch.tensor(clip)))
beats, downs = Postprocessor("minimal")(b, d)
starts = {str(t): [int(s) for s in split_piece(torch.zeros(t, 128), 1500, 6)[1]] for t in (251, 1486, 1488, 1489, 1551, 7841)}
json.dump({"source": "GOT DAMN 40 s to 71 s, small0, minimal postprocessing", "beatLogits": [round(float(v), 4) for v in b], "downbeatLogits": [round(float(v), 4) for v in d],
           "beats": [float(x) for x in beats], "downbeats": [float(x) for x in downs], "chunkStarts": starts},
          open(f"{out_dir}/peaks-reference.json", "w"))
print(mel.shape, len(b), len(beats), len(downs), starts)
