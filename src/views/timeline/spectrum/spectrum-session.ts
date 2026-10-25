import type { SpectrumChunkResult } from "@/audio/spectrum/spectrum-worker-protocol";
import { CHUNK_FRAMES, chunkCount } from "@/domain/spectrum/chunk-order";
import type { SpectrumSource } from "@/domain/spectrum/settings";
import { useSyncExternalStore } from "react";

// -- Types --------------------------------------------------------------------

type SpectrumStatus = "idle" | "decoding" | "analysing" | "ready" | "error";

interface SpectrumSessionState {
  generation: number;
  source: SpectrumSource;
  fftSize: number;
  hop: number;
  sampleRate: number;
  frames: number;
  bins: number;
  magnitude: Uint8Array | null;
  phaseChange: Uint8Array | null;
  rawPhase: Uint8Array | null;
  chunkReady: Uint8Array | null;
  rawReady: Uint8Array | null;
  readyChunks: number;
  status: SpectrumStatus;
  error: string | null;
}

interface SpectrumStatusView {
  status: SpectrumStatus;
  source: SpectrumSource;
  fftSize: number;
  percent: number;
  error: string | null;
}

interface SessionLayout {
  source: SpectrumSource;
  fftSize: number;
  hop: number;
  sampleRate: number;
  frames: number;
}

// -- State --------------------------------------------------------------------

// Read every frame by the canvas, so it is a plain object rather than a store.
const spectrumSession: SpectrumSessionState = {
  generation: 0,
  source: "mix",
  fftSize: 2048,
  hop: 512,
  sampleRate: 44100,
  frames: 0,
  bins: 0,
  magnitude: null,
  phaseChange: null,
  rawPhase: null,
  chunkReady: null,
  rawReady: null,
  readyChunks: 0,
  status: "idle",
  error: null,
};

const statusListeners = new Set<() => void>();
let statusView = snapshotStatus();

// -- Functions ----------------------------------------------------------------

function chunkTotal(): number {
  return chunkCount(spectrumSession.frames);
}

function snapshotStatus(): SpectrumStatusView {
  const total = chunkTotal();
  return {
    status: spectrumSession.status,
    source: spectrumSession.source,
    fftSize: spectrumSession.fftSize,
    percent: total > 0 ? Math.round((spectrumSession.readyChunks / total) * 100) : 0,
    error: spectrumSession.error,
  };
}

function notifyStatus(): void {
  const next = snapshotStatus();
  if (
    next.status === statusView.status &&
    next.percent === statusView.percent &&
    next.source === statusView.source &&
    next.fftSize === statusView.fftSize &&
    next.error === statusView.error
  ) {
    return;
  }
  statusView = next;
  for (const listener of statusListeners) listener();
}

function setSpectrumStatus(status: SpectrumStatus, error: string | null = null): void {
  spectrumSession.status = status;
  spectrumSession.error = error;
  notifyStatus();
}

function clearSpectrumSession(): void {
  spectrumSession.generation++;
  spectrumSession.frames = 0;
  spectrumSession.magnitude = null;
  spectrumSession.phaseChange = null;
  spectrumSession.rawPhase = null;
  spectrumSession.chunkReady = null;
  spectrumSession.rawReady = null;
  spectrumSession.readyChunks = 0;
  setSpectrumStatus("idle");
}

function beginSpectrumSession(layout: SessionLayout): void {
  const bins = layout.fftSize / 2 + 1;
  Object.assign(spectrumSession, layout, {
    generation: spectrumSession.generation + 1,
    bins,
    magnitude: new Uint8Array(layout.frames * bins),
    phaseChange: new Uint8Array(layout.frames * bins),
    rawPhase: null,
    chunkReady: new Uint8Array(chunkCount(layout.frames)),
    rawReady: new Uint8Array(chunkCount(layout.frames)),
    readyChunks: 0,
  });
  setSpectrumStatus("analysing");
}

function storeSpectrumChunk(
  chunk: number,
  magnitude: Uint8Array,
  phaseChange: Uint8Array,
  rawPhase: Uint8Array | null = null,
): void {
  const { chunkReady, bins } = spectrumSession;
  if (!chunkReady || !spectrumSession.magnitude || !spectrumSession.phaseChange || chunk >= chunkReady.length) return;
  const offset = chunk * CHUNK_FRAMES * bins;
  spectrumSession.magnitude.set(magnitude, offset);
  spectrumSession.phaseChange.set(phaseChange, offset);
  if (rawPhase && spectrumSession.rawReady) {
    spectrumSession.rawPhase ??= new Uint8Array(spectrumSession.frames * bins);
    spectrumSession.rawPhase.set(rawPhase, offset);
    spectrumSession.rawReady[chunk] = 1;
  }
  if (!chunkReady[chunk]) {
    chunkReady[chunk] = 1;
    spectrumSession.readyChunks++;
  }
  if (spectrumSession.readyChunks === chunkReady.length) setSpectrumStatus("ready");
  else notifyStatus();
}

function storeWorkerChunk(result: SpectrumChunkResult): void {
  storeSpectrumChunk(result.chunk, result.magnitude, result.phaseChange, result.rawPhase);
}

function subscribeSpectrumStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function useSpectrumStatus(): SpectrumStatusView {
  return useSyncExternalStore(subscribeSpectrumStatus, () => statusView);
}

// -- Exports ------------------------------------------------------------------

export {
  beginSpectrumSession,
  chunkTotal,
  clearSpectrumSession,
  setSpectrumStatus,
  spectrumSession,
  storeSpectrumChunk,
  storeWorkerChunk,
  useSpectrumStatus,
};
export type { SpectrumSessionState, SpectrumStatus, SpectrumStatusView };
