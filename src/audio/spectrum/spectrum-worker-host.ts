import type {
  SpectrumChunkResult,
  SpectrumWorkerRequest,
  SpectrumWorkerResult,
} from "@/audio/spectrum/spectrum-worker-protocol";

// -- Types --------------------------------------------------------------------

interface SpectrumAnalysis {
  setFocus(chunk: number): void;
  requestRawPhase(chunks: readonly number[]): void;
  dispose(): void;
}

interface SpectrumAnalysisOptions {
  pcm: Float32Array;
  sampleRate: number;
  fftSize: number;
  hop: number;
  focusChunk: number;
  skipChunks: readonly number[];
  onChunk: (result: SpectrumChunkResult) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

// -- Functions ----------------------------------------------------------------

// One worker per analysed source; pcm is transferred, so pass a buffer you own.
function startSpectrumAnalysis(options: SpectrumAnalysisOptions): SpectrumAnalysis {
  const worker = new Worker(new URL("./spectrum-worker.ts", import.meta.url), { type: "module" });
  const send = (request: SpectrumWorkerRequest, transfer: Transferable[] = []) => worker.postMessage(request, transfer);
  let disposed = false;

  worker.addEventListener("message", (event: MessageEvent<SpectrumWorkerResult>) => {
    if (disposed) return;
    const result = event.data;
    if (result.type === "chunk") options.onChunk(result);
    else if (result.type === "done") options.onDone();
    else options.onError(new Error(result.message));
  });
  worker.addEventListener("error", (event) => {
    if (!disposed) options.onError(new Error(event.message || "Spectrum worker failed."));
  });

  send(
    {
      type: "load",
      pcm: options.pcm,
      sampleRate: options.sampleRate,
      fftSize: options.fftSize,
      hop: options.hop,
      focusChunk: options.focusChunk,
      skipChunks: [...options.skipChunks],
    },
    [options.pcm.buffer],
  );

  return {
    setFocus: (chunk) => send({ type: "focus", chunk }),
    requestRawPhase: (chunks) => send({ type: "raw", chunks: [...chunks] }),
    dispose: () => {
      disposed = true;
      send({ type: "stop" });
      worker.terminate();
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { startSpectrumAnalysis };
export type { SpectrumAnalysis };
