import type { DspReply, DspRequest, PreparedChunk } from "@/audio/separation/roformer/dsp-worker";
import type { Spectrogram } from "@/audio/separation/stft";

// -- Types --------------------------------------------------------------------

interface Pending {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

// -- Lane ---------------------------------------------------------------------

/** One DSP worker, called like a function. Any failure rejects every call in flight and every later call. */
class DspLane {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private failure: Error | null = null;

  constructor(name: string) {
    this.worker = new Worker(new URL("./dsp-worker.ts", import.meta.url), { type: "module", name });
    this.worker.addEventListener("message", (ev: MessageEvent<DspReply>) => this.onReply(ev.data));
    this.worker.addEventListener("error", (ev) => {
      ev.preventDefault();
      this.fail(new Error(`The audio worker crashed: ${ev.message || "it didn't start"}`));
    });
    this.worker.addEventListener("messageerror", () =>
      this.fail(new Error("The audio worker sent an unreadable message.")),
    );
  }

  /** The first failure, if any. */
  get error(): Error | null {
    return this.failure;
  }

  loadSong(channels: Float32Array[], frames: number): Promise<void> {
    return this.call(
      { type: "load-song", channels, frames },
      channels.map((c) => c.buffer),
    ) as Promise<void>;
  }

  prepare(index: number): Promise<PreparedChunk> {
    return this.call({ type: "prepare", index }) as Promise<PreparedChunk>;
  }

  beginMix(frames: number, channelCount: number): Promise<void> {
    return this.call({ type: "begin-mix", frames, channelCount }) as Promise<void>;
  }

  mix(index: number, length: number, specs: Spectrogram[], masks: Float32Array): Promise<void> {
    const transfer = [masks.buffer, ...specs.flatMap((spec) => [spec.real.buffer, spec.imag.buffer])];
    return this.call({ type: "mix", index, length, specs, masks }, transfer) as Promise<void>;
  }

  endMix(): Promise<Float32Array[]> {
    return this.call({ type: "end-mix" }) as Promise<Float32Array[]>;
  }

  terminate(): void {
    this.worker.terminate();
    this.fail(new Error("The audio worker was stopped."));
  }

  private call(request: DspRequest, transfer: Transferable[] = []): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.nextId;
    const result = new Promise<unknown>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    try {
      this.worker.postMessage({ ...request, id }, transfer);
    } catch (err) {
      this.fail(err instanceof Error ? err : new Error(String(err)));
    }
    return result;
  }

  private onReply(reply: DspReply) {
    const pending = this.pending.get(reply.id);
    if (!pending) return;
    this.pending.delete(reply.id);
    if (reply.ok) pending.resolve(reply.result);
    else {
      const err = new Error(reply.message);
      this.failure ??= err;
      pending.reject(err);
    }
  }

  private fail(err: Error) {
    this.failure ??= err;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const p of pending) p.reject(this.failure);
  }
}

// -- Exports ------------------------------------------------------------------

export { DspLane };
