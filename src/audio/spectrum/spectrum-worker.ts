import { stftFrameCount } from "@/audio/separation/stft";
/// <reference lib="webworker" />
import { analyseChunk } from "@/audio/spectrum/analyse-chunk";
import type { SpectrumWorkerRequest, SpectrumWorkerResult } from "@/audio/spectrum/spectrum-worker-protocol";
import { chunkCount, nextChunk } from "@/domain/spectrum/chunk-order";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[Spectrum worker]";

// -- State ---------------------------------------------------------------------

let pcm: Float32Array | null = null;
let fftSize = 0;
let hop = 0;
let focus = 0;
let running = false;
const pending = new Set<number>();
const rawWanted = new Set<number>();

// -- Helpers -------------------------------------------------------------------

function post(result: SpectrumWorkerResult, transfer: Transferable[] = []): void {
  self.postMessage(result, transfer);
}

function yieldToMessages(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function takeNext(): { chunk: number; raw: boolean } | null {
  const raw = nextChunk(rawWanted, focus);
  if (raw !== null) {
    rawWanted.delete(raw);
    pending.delete(raw);
    return { chunk: raw, raw: true };
  }
  const chunk = nextChunk(pending, focus);
  if (chunk === null) return null;
  pending.delete(chunk);
  return { chunk, raw: false };
}

// Chunks run one at a time with a yield between them, so focus and raw requests reorder the queue.
async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let next = takeNext(); next && pcm; next = takeNext()) {
      const result = analyseChunk(pcm, fftSize, hop, next.chunk, next.raw);
      const transfer: Transferable[] = [result.magnitude.buffer, result.phaseChange.buffer];
      if (result.rawPhase) transfer.push(result.rawPhase.buffer);
      post({ type: "chunk", chunk: next.chunk, ...result }, transfer);
      await yieldToMessages();
    }
    if (pcm) post({ type: "done" });
  } catch (error) {
    console.error(LOG_PREFIX, "analysis failed", error);
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
  }
}

// -- Messages ------------------------------------------------------------------

self.onmessage = (event: MessageEvent<SpectrumWorkerRequest>) => {
  const request = event.data;
  if (request.type === "load") {
    ({ pcm, fftSize, hop } = request);
    focus = request.focusChunk;
    pending.clear();
    rawWanted.clear();
    const skipped = new Set(request.skipChunks);
    const total = chunkCount(stftFrameCount(request.pcm.length, true, { fftSize, hop }));
    for (let chunk = 0; chunk < total; chunk++) if (!skipped.has(chunk)) pending.add(chunk);
    void drain();
  } else if (request.type === "focus") {
    focus = request.chunk;
  } else if (request.type === "raw") {
    for (const chunk of request.chunks) rawWanted.add(chunk);
    void drain();
  } else {
    pending.clear();
    rawWanted.clear();
    pcm = null;
  }
};
