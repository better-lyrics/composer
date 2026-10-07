/// <reference lib="webworker" />
// biome-ignore organizeImports: the webworker triple-slash reference must stay before imports.
import { decodeAlignment } from "@/audio/alignment/hubertfa/decoder";
import { type Pronunciations, parseDictionary } from "@/audio/alignment/hubertfa/lexicon";
import { getAlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import { buildPhoneSequence, wordIntervalsFromPhones } from "@/audio/alignment/hubertfa/sequence";
import { chooseBackend } from "@/audio/separation/backend-selection";
import { type CachedAsset, fetchAndCacheModel, readCachedModel } from "@/audio/separation/model-cache";
import { type Backend, type Ort, type OrtSession, createSession, loadOrt } from "@/audio/separation/ort-runtime";
import { describeError, log } from "@/audio/separation/worker-log";
import type { WordInterval } from "@/domain/alignment/words";

declare const self: DedicatedWorkerGlobalScope;

// -- Types --------------------------------------------------------------------

type AlignOutcome =
  | { kind: "aligned"; intervals: WordInterval[] }
  | { kind: "unknown"; words: string[] }
  | { kind: "no-path" };

type InboundMessage =
  | { type: "init"; forceWasm?: boolean }
  | { type: "align"; samples: Float32Array; sampleRate: number; words: string[] }
  | { type: "cancel" };

type OutboundMessage =
  | { type: "init-progress"; loaded: number; total: number }
  | { type: "init-done"; backend: Backend }
  | { type: "align-done"; outcome: AlignOutcome }
  | { type: "cancelled" }
  | { type: "error"; code: string; message: string };

// -- Constants ----------------------------------------------------------------

const MODEL_SAMPLE_RATE = 44100;
const HOP_SIZE = 441;

// -- State --------------------------------------------------------------------

let ort: Ort | null = null;
let session: OrtSession | null = null;
let activeBackend: Backend = "wasm";
let dictionary: Pronunciations | null = null;
let downloadAbort: AbortController | null = null;

// -- Functions ----------------------------------------------------------------

function post(message: OutboundMessage) {
  self.postMessage(message);
}

async function loadAsset(
  asset: CachedAsset,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const cached = await readCachedModel(asset);
  if (cached) {
    onProgress(cached.byteLength, cached.byteLength);
    return cached;
  }
  return fetchAndCacheModel(asset, signal, onProgress);
}

async function handleInit(forceWasm?: boolean) {
  const assets = getAlignmentAssets();
  if (!assets) {
    post({ type: "error", code: "no-base-url", message: "VITE_VOCAL_MODEL_BASE_URL is not configured." });
    return;
  }

  downloadAbort = new AbortController();
  const progress = { dictionary: [0, assets.dictionary.approxBytes], model: [0, assets.model.approxBytes] };
  const report = () =>
    post({
      type: "init-progress",
      loaded: progress.dictionary[0] + progress.model[0],
      total: progress.dictionary[1] + progress.model[1],
    });

  let modelBytes: ArrayBuffer;
  try {
    const dictionaryBytes = await loadAsset(assets.dictionary, downloadAbort.signal, (loaded, total) => {
      progress.dictionary = [loaded, total];
      report();
    });
    dictionary = parseDictionary(new TextDecoder().decode(dictionaryBytes));
    modelBytes = await loadAsset(assets.model, downloadAbort.signal, (loaded, total) => {
      progress.model = [loaded, total];
      report();
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      post({ type: "cancelled" });
      return;
    }
    post({ type: "error", code: "fetch-failed", message: describeError(err) });
    return;
  } finally {
    downloadAbort = null;
  }

  try {
    const choice = await chooseBackend(forceWasm);
    let backend: Backend = choice.backend;
    log(choice.backend === "webgpu" ? `alignment on WebGPU (${choice.adapterLabel})` : "alignment on WASM (CPU)");
    let runtime: Ort;
    try {
      runtime = await loadOrt(backend, false);
    } catch (err) {
      if (backend === "wasm") throw err;
      log(`WebGPU runtime failed to load (${describeError(err)}); falling back to WASM (CPU)`);
      backend = "wasm";
      runtime = await loadOrt(backend, false);
    }
    try {
      session = await createSession(runtime, modelBytes, backend);
    } catch (err) {
      if (backend === "wasm") throw err;
      log(`WebGPU session creation failed (${describeError(err)}); falling back to WASM (CPU)`);
      backend = "wasm";
      session = await createSession(runtime, modelBytes, backend);
    }
    ort = runtime;
    activeBackend = backend;
    post({ type: "init-done", backend });
  } catch (err) {
    log("alignment init failed:", err);
    post({ type: "error", code: "ort-failed", message: describeError(err) });
  }
}

// Some GPUs fail kernels only at run time. Rebuild the session on the CPU from
// the download cache rather than failing every remaining line.
async function fallBackToWasm(reason: unknown): Promise<void> {
  const assets = getAlignmentAssets();
  if (!assets || !ort) throw reason;
  log(`WebGPU run failed (${describeError(reason)}); switching alignment to WASM (CPU)`);
  const modelBytes = await readCachedModel(assets.model);
  if (!modelBytes) throw reason;
  await session?.release?.();
  session = await createSession(ort, modelBytes, "wasm");
  activeBackend = "wasm";
}

async function runModel(samples: Float32Array) {
  if (!session || !ort) throw new Error("Alignment model is not loaded.");
  const feeds = { waveform: new ort.Tensor("float32", samples, [1, samples.length]) };
  try {
    return await session.run(feeds);
  } catch (err) {
    if (activeBackend !== "webgpu") throw err;
    await fallBackToWasm(err);
    return session.run(feeds);
  }
}

async function handleAlign(samples: Float32Array, sampleRate: number, words: string[]) {
  if (!session || !ort || !dictionary) {
    post({ type: "error", code: "ort-failed", message: "Alignment model is not loaded." });
    return;
  }
  if (sampleRate !== MODEL_SAMPLE_RATE) {
    post({
      type: "error",
      code: "bad-input",
      message: `Expected ${MODEL_SAMPLE_RATE} Hz audio, got ${sampleRate} Hz.`,
    });
    return;
  }
  const built = buildPhoneSequence(words, dictionary);
  if (built.kind === "unknown") {
    post({ type: "align-done", outcome: { kind: "unknown", words: built.words } });
    return;
  }
  if (built.kind === "nothing-to-align") {
    post({ type: "align-done", outcome: { kind: "no-path" } });
    return;
  }
  try {
    const outputs = await runModel(samples);
    const logits = outputs.ph_frame_logits;
    const phones = decodeAlignment({
      frameLogits: logits.data,
      edgeLogits: outputs.ph_edge_logits.data,
      vocabSize: logits.dims[1],
      frames: logits.dims[2],
      numSamples: samples.length,
      sampleRate,
      hopSize: HOP_SIZE,
      phoneIds: built.sequence.phoneIds,
    });
    const outcome: AlignOutcome = phones
      ? { kind: "aligned", intervals: wordIntervalsFromPhones(phones, built.sequence, words.length) }
      : { kind: "no-path" };
    post({ type: "align-done", outcome });
  } catch (err) {
    post({ type: "error", code: "ort-failed", message: describeError(err) });
  }
}

// -- Entry --------------------------------------------------------------------

self.addEventListener("message", (ev: MessageEvent<InboundMessage>) => {
  const msg = ev.data;
  if (msg.type === "init") void handleInit(msg.forceWasm);
  else if (msg.type === "align") void handleAlign(msg.samples, msg.sampleRate, msg.words);
  else if (msg.type === "cancel") downloadAbort?.abort();
});

// -- Exports ------------------------------------------------------------------

export type { AlignOutcome, InboundMessage, OutboundMessage };
