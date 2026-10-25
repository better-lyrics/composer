import { decodeSourceAudio } from "@/audio/decoded-source-audio";
import { mixToMono } from "@/audio/onset-detection";
import { stftFrameCount } from "@/audio/separation/stft";
import {
  type CachedSpectrumChunk,
  createSpectrumChunkWriter,
  readSpectrumChunks,
} from "@/audio/spectrum/spectrum-cache";
import { type SpectrumAnalysis, startSpectrumAnalysis } from "@/audio/spectrum/spectrum-worker-host";
import type { ResolvedAnalysis } from "@/domain/spectrum/analysis-window";
import { CHUNK_FRAMES, chunkCount } from "@/domain/spectrum/chunk-order";
import { holdFrames, wake } from "@/lib/frame-loop";
import {
  beginSpectrumSession,
  setSpectrumStatus,
  storeSpectrumChunk,
  storeWorkerChunk,
} from "@/views/timeline/spectrum/spectrum-session";

// -- Types --------------------------------------------------------------------

interface SpectrumTarget extends ResolvedAnalysis {
  sourceKey: string;
  audio: Blob | (() => Promise<Blob>);
  jobKey: string | null;
}

interface MonoAudio {
  pcm: Float32Array;
  sampleRate: number;
}

interface SpectrumRun {
  setFocusTime(seconds: number): void;
  requestRawPhase(chunks: readonly number[]): void;
  cancel(): void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Spectrum]";
const MONO_CACHE_SIZE = 2;

// -- State --------------------------------------------------------------------

const monoCache = new Map<string, Promise<MonoAudio>>();

// -- Functions ----------------------------------------------------------------

// Mono audio is kept per source, so hiding and showing the spectrum never decodes again.
function decodeMono(target: SpectrumTarget): Promise<MonoAudio> {
  const cached = monoCache.get(target.sourceKey);
  if (cached) return cached;
  const decoding = (async () => {
    const blob = typeof target.audio === "function" ? await target.audio() : target.audio;
    const buffer = await decodeSourceAudio(blob);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return { pcm: mixToMono(channels), sampleRate: buffer.sampleRate };
  })();
  decoding.catch(() => monoCache.delete(target.sourceKey));
  monoCache.set(target.sourceKey, decoding);
  for (const key of monoCache.keys()) {
    if (monoCache.size <= MONO_CACHE_SIZE) break;
    monoCache.delete(key);
  }
  return decoding;
}

async function readCachedChunks(target: SpectrumTarget, total: number): Promise<Map<number, CachedSpectrumChunk>> {
  if (!target.jobKey) return new Map();
  try {
    return await readSpectrumChunks(target.jobKey, target.source, target.fftSize, total);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read the cached spectrum; analysing again", error);
    return new Map();
  }
}

function startSpectrumRun(target: SpectrumTarget, focusTime: number): SpectrumRun {
  let cancelled = false;
  let analysis: SpectrumAnalysis | null = null;
  let sampleRate = 0;
  let release: (() => void) | null = holdFrames("spectrum analysis");
  const writer = target.jobKey ? createSpectrumChunkWriter(target.jobKey, target.source, target.fftSize) : null;
  const finish = () => {
    release?.();
    release = null;
  };
  const chunkAt = (seconds: number) => Math.max(0, Math.floor((seconds * sampleRate) / target.hop / CHUNK_FRAMES));
  const fail = (error: unknown) => {
    if (cancelled) return;
    console.error(LOG_PREFIX, "analysis failed", error);
    setSpectrumStatus("error", error instanceof Error ? error.message : String(error));
    finish();
  };

  setSpectrumStatus("decoding");
  void (async () => {
    const mono = await decodeMono(target);
    if (cancelled) return;
    sampleRate = mono.sampleRate;
    const frames = stftFrameCount(mono.pcm.length, true, { fftSize: target.fftSize, hop: target.hop });
    beginSpectrumSession({ source: target.source, fftSize: target.fftSize, hop: target.hop, sampleRate, frames });
    const cached = await readCachedChunks(target, chunkCount(frames));
    if (cancelled) return;
    for (const [chunk, stored] of cached) storeSpectrumChunk(chunk, stored.magnitude, stored.phaseChange);
    if (cached.size === chunkCount(frames)) return finish();
    analysis = startSpectrumAnalysis({
      pcm: mono.pcm.slice(),
      sampleRate,
      fftSize: target.fftSize,
      hop: target.hop,
      focusChunk: chunkAt(focusTime),
      skipChunks: [...cached.keys()],
      onChunk: (result) => {
        storeWorkerChunk(result);
        wake();
        writer?.add(result.chunk, result.magnitude, result.phaseChange);
      },
      onDone: () => {
        void writer?.flush();
        finish();
      },
      onError: fail,
    });
  })().catch(fail);

  return {
    setFocusTime: (seconds) => {
      if (sampleRate > 0) analysis?.setFocus(chunkAt(seconds));
    },
    requestRawPhase: (chunks) => analysis?.requestRawPhase(chunks),
    cancel: () => {
      cancelled = true;
      analysis?.dispose();
      void writer?.flush();
      finish();
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { startSpectrumRun };
export type { SpectrumRun, SpectrumTarget };
