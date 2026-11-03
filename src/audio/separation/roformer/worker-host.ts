import type { InboundMessage, OutboundMessage } from "@/audio/separation/roformer/worker";
import type { ProcessOptions, ProcessResult, VocalSeparator } from "@/audio/separation/vocal-separator";

// -- Types --------------------------------------------------------------------

interface Pending {
  resolve: (vocals: Float32Array[] | undefined) => void;
  reject: (err: Error) => void;
  onProgress?: (loaded: number, total: number) => void;
}

type Request = Exclude<InboundMessage, { type: "cancel" }>;
type RequestBody = Request extends infer R ? (R extends Request ? Omit<R, "seq"> : never) : never;

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[roformer-host]";
// A worker's memory is freed some seconds after it ends. Loading a model before then holds both, which on a tight
// GPU is the difference between fitting and not, so a new worker waits this long after the last one ended.
const MEMORY_SETTLE_MS = 8_000;
// The model downloads in parts, so a quiet worker during init is a hung session create.
const INIT_INACTIVITY_TIMEOUT_MS = 120_000;
const RELEASE_TIMEOUT_MS = 5_000;

// -- Functions ----------------------------------------------------------------

function workerError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Host ---------------------------------------------------------------------

// Unlike the HTDemucs worker this one outlives a song: its sessions are reused for the next one. It ends on a
// failure, when the user picks another model, and before the alignment model loads.
class RoformerWorker implements VocalSeparator {
  private worker: Worker | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();
  private endedAt = Number.NEGATIVE_INFINITY;
  private initTimer: ReturnType<typeof setTimeout> | null = null;

  get busy(): boolean {
    return this.pending.size > 0;
  }

  /** Resolves once memory from an ended worker has had time to be freed. */
  async settled(): Promise<void> {
    const wait = this.endedAt + MEMORY_SETTLE_MS - performance.now();
    if (wait > 0) await sleep(wait);
  }

  async init(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (!this.worker) await this.settled();
    this.armInitTimeout();
    try {
      await this.request({ type: "init" }, (loaded, total) => {
        this.armInitTimeout();
        onProgress?.(loaded, total);
      });
    } finally {
      this.clearInitTimeout();
    }
  }

  async process(opts: ProcessOptions): Promise<ProcessResult> {
    // A copy is transferred, so the caller's channels stay usable.
    const channels = opts.channels.map((c) => new Float32Array(c));
    const vocals = await this.request(
      { type: "process", channels, totalFrames: opts.totalFrames },
      opts.onProgress,
      channels.map((c) => c.buffer),
    );
    if (!vocals) throw new Error("The vocal model returned no audio.");
    return { vocals, numChannels: vocals.length, totalFrames: opts.totalFrames };
  }

  cancel(): void {
    this.worker?.postMessage({ type: "cancel" } satisfies InboundMessage);
  }

  /** Frees the model's memory unless it's separating. */
  async releaseIfIdle(): Promise<void> {
    if (!this.worker || this.busy) return;
    let settled = false;
    const released = this.request({ type: "release" })
      .catch((err: unknown) => console.warn(LOG_PREFIX, "releasing the sessions failed; ending the worker anyway", err))
      .finally(() => {
        settled = true;
      });
    await Promise.race([released, sleep(RELEASE_TIMEOUT_MS)]);
    // A release that hasn't answered is ended with the worker, unless a song was sent in the meantime.
    if (this.pending.size === (settled ? 0 : 1)) this.dispose();
  }

  /** Ends the worker; anything in flight fails. */
  dispose(): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    this.clearInitTimeout();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.endedAt = performance.now();
    }
    for (const p of pending) p.reject(workerError("The vocal model stopped.", "worker-ended"));
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("error", (ev) => {
      console.error(LOG_PREFIX, "worker error event", ev.message, ev);
      this.failAll(workerError(`The vocal model crashed: ${ev.message || "unknown error"}`, "worker-error"));
    });
    worker.addEventListener("messageerror", () =>
      this.failAll(workerError("The vocal model sent an unreadable message.", "worker-messageerror")),
    );
    worker.addEventListener("message", (ev: MessageEvent<OutboundMessage>) => this.onMessage(ev.data));
    this.worker = worker;
    return worker;
  }

  private request(
    body: RequestBody,
    onProgress?: (loaded: number, total: number) => void,
    transfer: Transferable[] = [],
  ): Promise<Float32Array[] | undefined> {
    const seq = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(seq, { resolve, reject, onProgress });
      this.ensureWorker().postMessage({ ...body, seq } as Request, transfer);
    });
  }

  private onMessage(msg: OutboundMessage) {
    const pending = this.pending.get(msg.seq);
    if (!pending) return;
    if (msg.type === "progress") {
      pending.onProgress?.(msg.loaded, msg.total);
      return;
    }
    this.pending.delete(msg.seq);
    if (msg.type === "done") pending.resolve(msg.vocals);
    else if (msg.type === "cancelled") pending.reject(new DOMException("Cancelled", "AbortError"));
    else {
      pending.reject(workerError(msg.message, msg.code));
      // After a failure the GPU state is unknown, so the next run starts from a fresh worker.
      this.dispose();
    }
  }

  private failAll(err: Error) {
    const pending = [...this.pending.values()];
    this.pending.clear();
    this.dispose();
    for (const p of pending) p.reject(err);
  }

  private armInitTimeout() {
    this.clearInitTimeout();
    this.initTimer = setTimeout(
      () => this.failAll(workerError("The vocal model stopped responding while loading.", "init-timeout")),
      INIT_INACTIVITY_TIMEOUT_MS,
    );
  }

  private clearInitTimeout() {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.initTimer = null;
  }
}

// -- Exports ------------------------------------------------------------------

export { RoformerWorker };
