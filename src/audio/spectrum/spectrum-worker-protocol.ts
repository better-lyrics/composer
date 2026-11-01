// -- Types --------------------------------------------------------------------

type SpectrumWorkerRequest =
  | {
      type: "load";
      pcm: Float32Array;
      sampleRate: number;
      fftSize: number;
      hop: number;
      focusChunk: number;
      skipChunks: number[];
    }
  | { type: "focus"; chunk: number }
  | { type: "raw"; chunks: number[] }
  | { type: "stop" };

interface SpectrumChunkResult {
  type: "chunk";
  chunk: number;
  firstFrame: number;
  frameCount: number;
  magnitude: Uint8Array;
  phaseChange: Uint8Array;
  rawPhase: Uint8Array | null;
}

type SpectrumWorkerResult = SpectrumChunkResult | { type: "done" } | { type: "error"; message: string };

// -- Exports ------------------------------------------------------------------

export type { SpectrumChunkResult, SpectrumWorkerRequest, SpectrumWorkerResult };
