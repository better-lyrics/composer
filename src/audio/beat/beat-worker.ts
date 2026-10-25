/// <reference lib="webworker" />
// biome-ignore organizeImports: the webworker triple-slash reference must stay before imports.
import { chunkInput, chunkStarts, mergeChunkLogits, type ChunkLogits } from "@/audio/beat/beat-chunks";
import { N_MELS, logMel } from "@/audio/beat/beat-features";
import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { beatsFromLogits } from "@/audio/beat/beat-peaks";
import type { BeatDetectionErrorCode, BeatWorkerEvent, BeatWorkerRequest } from "@/audio/beat/beat-worker-messages";
import { type OrtSession, loadOrt } from "@/audio/ort-runtime";
import { fetchAndCacheModel, readCachedModel } from "@/audio/separation/model-cache";
import { regularBeats } from "@/domain/tempo/regular-beats";

// -- Helpers -------------------------------------------------------------------

function post(event: BeatWorkerEvent): void {
  self.postMessage(event);
}

class BeatWorkerError extends Error {
  constructor(
    readonly code: BeatDetectionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

async function readModel(): Promise<ArrayBuffer> {
  try {
    const cached = await readCachedModel(BEAT_MODEL);
    if (cached) return cached;
    return await fetchAndCacheModel(BEAT_MODEL, new AbortController().signal, (loaded, total) =>
      post({ type: "download-progress", loaded, total }),
    );
  } catch (error) {
    throw new BeatWorkerError("fetch-failed", (error as Error).message);
  }
}

async function openSession(model: ArrayBuffer, forceWasm: boolean | undefined) {
  try {
    const ort = await loadOrt(forceWasm);
    const session = await ort.InferenceSession.create(model, {
      executionProviders: forceWasm ? ["wasm"] : ["webgpu", "wasm"],
      graphOptimizationLevel: "all",
    });
    return { ort, session };
  } catch (error) {
    throw new BeatWorkerError("ort-failed", (error as Error).message);
  }
}

// -- Detection -----------------------------------------------------------------

async function detect({ signal, forceWasm }: BeatWorkerRequest): Promise<void> {
  const model = await readModel();
  const { ort, session } = await openSession(model, forceWasm);
  const { mel, frames } = logMel(signal);
  const starts = chunkStarts(frames);
  const chunks: ChunkLogits[] = [];
  try {
    for (const start of starts) {
      const chunk = chunkInput(mel, frames, start);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one session runs one chunk at a time, and progress follows each chunk
      const output = await runChunk(session, new ort.Tensor("float32", chunk.input, [1, chunk.frames, N_MELS]));
      chunks.push(output);
      post({ type: "detect-progress", done: chunks.length, total: starts.length });
    }
  } catch (error) {
    throw new BeatWorkerError("ort-failed", (error as Error).message);
  } finally {
    await session.release?.();
  }
  const logits = mergeChunkLogits(chunks, starts, frames);
  const { beats, downbeats } = regularBeats(beatsFromLogits(logits.beat, logits.downbeat));
  post({ type: "done", beats, downbeats });
}

async function runChunk(session: OrtSession, spect: Parameters<OrtSession["run"]>[0][string]): Promise<ChunkLogits> {
  const output = await session.run({ spect });
  return { beat: Float32Array.from(output.beat.data), downbeat: Float32Array.from(output.downbeat.data) };
}

self.addEventListener("message", (event: MessageEvent<BeatWorkerRequest>) => {
  detect(event.data).catch((error: unknown) => {
    const code = error instanceof BeatWorkerError ? error.code : "ort-failed";
    post({ type: "error", code, message: error instanceof Error ? error.message : String(error) });
  });
});
