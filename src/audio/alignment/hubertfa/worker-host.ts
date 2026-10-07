import type { HanReading } from "@/audio/alignment/hubertfa/g2p";
import type { AlignOutcome, InboundMessage, OutboundMessage } from "@/audio/alignment/hubertfa/worker";
import type { Backend } from "@/audio/separation/ort-runtime";

// -- Types --------------------------------------------------------------------

interface Pending {
  resolve: (msg: OutboundMessage) => void;
  reject: (err: Error) => void;
  onProgress?: (loaded: number, total: number) => void;
}

// -- Constants ----------------------------------------------------------------

// The download can take minutes, so init fails only when the worker goes quiet
// this long, which is what a hung session create looks like.
const INIT_INACTIVITY_TIMEOUT_MS = 120_000;

// -- Functions ----------------------------------------------------------------

function workerError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

// -- Host ---------------------------------------------------------------------

// One request at a time: the store aligns lines in order and awaits each.
class AlignmentWorker {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private initTimer: ReturnType<typeof setTimeout> | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      this.worker.addEventListener("error", (ev) =>
        this.fail(workerError(`Alignment worker crashed: ${ev.message || "unknown error"}`, "worker-error")),
      );
      this.worker.addEventListener("messageerror", () =>
        this.fail(workerError("Alignment worker sent an unreadable message.", "worker-messageerror")),
      );
      this.worker.addEventListener("message", (ev: MessageEvent<OutboundMessage>) => this.onMessage(ev.data));
    }
    return this.worker;
  }

  private onMessage(msg: OutboundMessage) {
    const pending = this.pending;
    if (!pending) return;
    if (msg.type === "init-progress") {
      this.armInitTimeout();
      pending.onProgress?.(msg.loaded, msg.total);
      return;
    }
    this.settle();
    if (msg.type === "cancelled") pending.reject(new DOMException("Cancelled", "AbortError"));
    else if (msg.type === "error") pending.reject(workerError(msg.message, msg.code));
    else pending.resolve(msg);
  }

  private armInitTimeout() {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.initTimer = setTimeout(
      () => this.fail(workerError("Alignment model initialisation stopped responding.", "init-timeout")),
      INIT_INACTIVITY_TIMEOUT_MS,
    );
  }

  private settle() {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.initTimer = null;
    this.pending = null;
  }

  // After a crash or hang the worker's state is unknown, so start over.
  private fail(err: Error) {
    const pending = this.pending;
    this.dispose();
    pending?.reject(err);
  }

  private request(message: InboundMessage, transfer: Transferable[] = [], onProgress?: Pending["onProgress"]) {
    if (this.pending) return Promise.reject(workerError("Alignment worker is busy.", "busy"));
    return new Promise<OutboundMessage>((resolve, reject) => {
      this.pending = { resolve, reject, onProgress };
      this.ensureWorker().postMessage(message, transfer);
    });
  }

  async init(onProgress?: (loaded: number, total: number) => void, japanese = false): Promise<Backend> {
    const promise = this.request({ type: "init", japanese }, [], onProgress);
    this.armInitTimeout();
    const msg = await promise;
    if (msg.type !== "init-done") throw workerError("Unexpected reply to init.", "protocol");
    return msg.backend;
  }

  async align(
    samples: Float32Array,
    sampleRate: number,
    words: string[][],
    hanReading: HanReading,
  ): Promise<AlignOutcome> {
    // Copy so the transfer doesn't detach the caller's view of the song.
    const copy = new Float32Array(samples);
    const msg = await this.request({ type: "align", samples: copy, sampleRate, words, hanReading }, [copy.buffer]);
    if (msg.type !== "align-done") throw workerError("Unexpected reply to align.", "protocol");
    return msg.outcome;
  }

  cancel(): void {
    this.worker?.postMessage({ type: "cancel" } satisfies InboundMessage);
  }

  // Terminating the worker is what frees the WebGPU device's memory.
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.settle();
  }
}

// -- Exports ------------------------------------------------------------------

export { AlignmentWorker };
