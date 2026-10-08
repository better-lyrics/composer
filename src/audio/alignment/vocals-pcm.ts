import { mixToMono } from "@/audio/onset-detection";
import { decodeFileToFloat32 } from "@/audio/separation/audio-codec";

// -- Types --------------------------------------------------------------------

interface MonoPcm {
  samples: Float32Array;
  sampleRate: number;
}

// -- State --------------------------------------------------------------------

// Decoding a full song takes a noticeable moment, and aligning line by line
// would otherwise redo it for every request against the same stem.
let cached: { url: string; pcm: Promise<MonoPcm> } | null = null;

// -- Functions ----------------------------------------------------------------

async function decodeMonoPcm(url: string): Promise<MonoPcm> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read vocal stem (${response.status}).`);
  const decoded = await decodeFileToFloat32(await response.blob());
  return { samples: mixToMono(decoded.channels), sampleRate: decoded.sampleRate };
}

function loadVocalsPcm(url: string): Promise<MonoPcm> {
  if (cached?.url !== url) {
    const pcm = decodeMonoPcm(url);
    cached = { url, pcm };
    pcm.catch(() => {
      if (cached?.pcm === pcm) cached = null;
    });
  }
  return cached.pcm;
}

// -- Exports ------------------------------------------------------------------

export { loadVocalsPcm };
