import { decodeSourceAudio } from "@/audio/decoded-source-audio";
import { mixToMono } from "@/audio/onset-detection";
import { stftFrameCount } from "@/audio/separation/stft";
import {
  type CachedSpectrumChunk,
  type SpectrumChunkWriter,
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
  spectrumSession,
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
const MONO_CACHE_SIZE = 1;

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

async function readCachedChunks(
  target: SpectrumTarget,
  sampleRate: number,
  total: number,
): Promise<Map<number, CachedSpectrumChunk>> {
  if (!target.jobKey) return new Map();
  try {
    return await readSpectrumChunks(target.jobKey, target.source, sampleRate, target.fftSize, total);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read the cached spectrum; analysing again", error);
    return new Map();
  }
}

function startSpectrumRun(target: SpectrumTarget, focusTime: number): SpectrumRun {
  let cancelled = false;
  let analysis: SpectrumAnalysis | null = null;
  let mono: MonoAudio | null = null;
  let writer: SpectrumChunkWriter | null = null;
  let focusChunk = 0;
  const rawQueue = new Set<number>();
  let release: (() => void) | null = holdFrames("spectrum analysis");
  const finish = () => {
    release?.();
    release = null;
  };
  const chunkAt = (seconds: number) =>
    mono ? Math.max(0, Math.floor((seconds * mono.sampleRate) / target.hop / CHUNK_FRAMES)) : 0;
  const fail = (error: unknown) => {
    if (cancelled) return;
    console.error(LOG_PREFIX, "analysis failed", error);
    setSpectrumStatus("error", error instanceof Error ? error.message : String(error));
    finish();
  };

  // A worker starts for missing chunks, or later on demand when raw phase is wanted for cached ones.
  const startAnalysis = (audio: MonoAudio, skipChunks: readonly number[]) => {
    release ??= holdFrames("spectrum analysis");
    analysis = startSpectrumAnalysis({
      pcm: audio.pcm.slice(),
      sampleRate: audio.sampleRate,
      fftSize: target.fftSize,
      hop: target.hop,
      focusChunk,
      skipChunks,
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
    if (rawQueue.size > 0) analysis.requestRawPhase([...rawQueue]);
    rawQueue.clear();
  };

  setSpectrumStatus("decoding");
  void (async () => {
    const audio = await decodeMono(target);
    if (cancelled) return;
    mono = audio;
    focusChunk = chunkAt(focusTime);
    const frames = stftFrameCount(audio.pcm.length, true, { fftSize: target.fftSize, hop: target.hop });
    beginSpectrumSession({
      source: target.source,
      fftSize: target.fftSize,
      hop: target.hop,
      sampleRate: audio.sampleRate,
      frames,
    });
    const total = chunkCount(frames);
    const cached = await readCachedChunks(target, audio.sampleRate, total);
    if (cancelled) return;
    for (const [chunk, stored] of cached) storeSpectrumChunk(chunk, stored.magnitude, stored.phaseChange);
    writer = target.jobKey
      ? createSpectrumChunkWriter(target.jobKey, target.source, audio.sampleRate, target.fftSize)
      : null;
    if (cached.size === total && rawQueue.size === 0) return finish();
    startAnalysis(
      audio,
      Array.from({ length: total }, (_, chunk) => chunk).filter((chunk) => cached.has(chunk)),
    );
  })().catch(fail);

  return {
    setFocusTime: (seconds) => {
      focusChunk = chunkAt(seconds);
      analysis?.setFocus(focusChunk);
    },
    requestRawPhase: (chunks) => {
      if (cancelled) return;
      if (analysis) analysis.requestRawPhase(chunks);
      else {
        for (const chunk of chunks) rawQueue.add(chunk);
        if (mono && spectrumSession.chunkReady) {
          const ready = spectrumSession.chunkReady;
          startAnalysis(
            mono,
            Array.from({ length: ready.length }, (_, chunk) => chunk),
          );
        }
      }
    },
    cancel: () => {
      cancelled = true;
      analysis?.dispose();
      finish();
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { startSpectrumRun };
export type { SpectrumRun, SpectrumTarget };
