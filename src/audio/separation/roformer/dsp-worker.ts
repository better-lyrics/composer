/// <reference lib="webworker" />

import {
  addChunk,
  chunkAt,
  type DemixPlan,
  type DemixSum,
  demixPlan,
  demixSum,
  finishDemix,
  padSong,
} from "@/audio/separation/roformer/demix";
import { bandLayout } from "@/audio/separation/roformer/spec";
import { bandFeatures, chunkSpectrogram, maskedChannels } from "@/audio/separation/roformer/spectral";
import type { Spectrogram } from "@/audio/separation/stft";
import { describeError } from "@/audio/separation/worker-log";

declare const self: DedicatedWorkerGlobalScope;

// The RoFormer's CPU side, off the worker that drives the GPU: there, a long synchronous step keeps the next graph
// from being submitted, and the GPU sits idle. One instance prepares chunks (STFT and band gather), another mixes
// them back (mask, inverse STFT, overlap-add), each a queue in arrival order.

// -- Types --------------------------------------------------------------------

type DspRequest =
  | { type: "load-song"; channels: Float32Array[]; frames: number }
  | { type: "prepare"; index: number }
  | { type: "begin-mix"; frames: number; channelCount: number }
  | { type: "mix"; index: number; length: number; specs: Spectrogram[]; masks: Float32Array }
  | { type: "end-mix" };

type DspReply = { id: number; ok: true; result?: unknown } | { id: number; ok: false; message: string };

interface PreparedChunk {
  specs: Spectrogram[];
  features: Float32Array;
  /** Song samples in the chunk; the rest is padding. */
  length: number;
}

// -- State --------------------------------------------------------------------

const layout = bandLayout();
let song: { padded: Float32Array[]; starts: number[] } | null = null;
let mixing: { plan: DemixPlan; acc: DemixSum; frames: number; next: number } | null = null;

// -- Helpers ------------------------------------------------------------------

function specBuffers(specs: readonly Spectrogram[]): ArrayBuffer[] {
  return specs.flatMap((spec) => [spec.real.buffer as ArrayBuffer, spec.imag.buffer as ArrayBuffer]);
}

// -- Requests -----------------------------------------------------------------

function prepare(index: number): [PreparedChunk, Transferable[]] {
  if (!song) throw new Error("No song is loaded.");
  const chunk = chunkAt(song.padded, song.starts[index]);
  const specs = chunk.channels.map(chunkSpectrogram);
  const features = bandFeatures(specs, layout);
  return [{ specs, features, length: chunk.length }, [features.buffer, ...specBuffers(specs)]];
}

// Chunks are added in index order, as they were on one thread, so the float sums and the stems come out the same.
function mix(index: number, length: number, specs: Spectrogram[], masks: Float32Array): void {
  if (!mixing) throw new Error("No mix is open.");
  if (index !== mixing.next) throw new Error(`Chunk ${index} arrived out of order (expected ${mixing.next}).`);
  if (masks.some((v) => !Number.isFinite(v))) throw new Error("The vocal model returned invalid values.");
  const { plan, acc } = mixing;
  addChunk(acc, maskedChannels(specs, masks, layout), plan.starts[index], length, plan.windows[index]);
  mixing.next += 1;
}

function handle(request: DspRequest): [unknown, Transferable[]] {
  switch (request.type) {
    case "load-song": {
      const plan = demixPlan(request.frames);
      song = { padded: padSong(request.channels, plan.pad), starts: plan.starts };
      return [undefined, []];
    }
    case "prepare":
      return prepare(request.index);
    case "begin-mix": {
      const plan = demixPlan(request.frames);
      const acc = demixSum(request.frames + 2 * plan.pad, request.channelCount);
      mixing = { plan, acc, frames: request.frames, next: 0 };
      return [undefined, []];
    }
    case "mix":
      mix(request.index, request.length, request.specs, request.masks);
      return [undefined, []];
    case "end-mix": {
      if (!mixing) throw new Error("No mix is open.");
      const vocals = finishDemix(mixing.acc, mixing.plan.pad, mixing.frames);
      mixing = null;
      return [vocals, vocals.map((channel) => channel.buffer)];
    }
  }
}

self.addEventListener("message", (ev: MessageEvent<DspRequest & { id: number }>) => {
  const { id } = ev.data;
  try {
    const [result, transfer] = handle(ev.data);
    self.postMessage({ id, ok: true, result } satisfies DspReply, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, message: describeError(err) } satisfies DspReply);
  }
});

export type { DspReply, DspRequest, PreparedChunk };
