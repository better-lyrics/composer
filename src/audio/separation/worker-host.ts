import type { InboundMessage, OutboundMessage } from "@/audio/separation/worker";
import type { VocalModelVariant } from "@/stores/settings";

interface InitOptions {
  variant: VocalModelVariant;
  forceWasm?: boolean;
  /** Log real GPU kernel time (WebGPU timestamp queries). Defaults to the localStorage debug flag. */
  profile?: boolean;
  onProgress?: (loaded: number, total: number) => void;
}

interface ProcessOptions {
  channels: Float32Array[];
  totalFrames: number;
  onProgress?: (processed: number, total: number) => void;
}

interface ProcessResult {
  vocals: Float32Array[];
  numChannels: number;
  totalFrames: number;
}

// init() has no fixed deadline because the model download can legitimately take
// minutes. Instead it fails if the worker goes quiet (no progress, no result)
// for this long, which is what a hung ORT session create looks like.
const INIT_INACTIVITY_TIMEOUT_MS = 120_000;

// Set `localStorage["composer.profileSeparation"] = "1"` in DevTools to log GPU
// kernel time. Off by default because timestamp queries add overhead.
function readProfileFlag(): boolean {
  try {
    return localStorage.getItem("composer.profileSeparation") === "1";
  } catch {
    return false;
  }
}

function workerError(message: string, code: string): Error {
  const err = new Error(message);
  (err as Error & { code?: string }).code = code;
  return err;
}

class SeparationWorker {
  private worker: Worker | null = null;
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private currentResolve: ((value: unknown) => void) | null = null;
  private currentReject: ((reason: Error) => void) | null = null;
  private currentProgress: ((loaded: number, total: number) => void) | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      this.worker.addEventListener("error", (ev) => {
        console.error("[separation-host] worker error event", ev.message, ev.filename, ev.lineno, ev);
        this.failCurrent(workerError(`Separation worker crashed: ${ev.message || "unknown error"}`, "worker-error"));
      });
      this.worker.addEventListener("messageerror", (ev) => {
        console.error("[separation-host] worker messageerror", ev);
        this.failCurrent(workerError("Separation worker sent an unreadable message.", "worker-messageerror"));
      });
      this.worker.addEventListener("message", (ev: MessageEvent<OutboundMessage>) => this.onMessage(ev.data));
    }
    return this.worker;
  }

  private onMessage(msg: OutboundMessage) {
    if (msg.type === "init-progress" || msg.type === "process-progress") {
      const loaded = msg.type === "init-progress" ? msg.loaded : msg.processed;
      const total = msg.type === "init-progress" ? msg.total : msg.total;
      if (msg.type === "init-progress" && this.initTimer) this.armInitTimeout();
      this.currentProgress?.(loaded, total);
      return;
    }
    if (msg.type === "init-done") {
      this.currentResolve?.(undefined);
      this.clearCurrent();
      return;
    }
    if (msg.type === "process-done") {
      this.currentResolve?.({ vocals: msg.vocals, numChannels: msg.numChannels, totalFrames: msg.totalFrames });
      this.clearCurrent();
      return;
    }
    if (msg.type === "cancelled") {
      this.currentReject?.(new DOMException("Cancelled", "AbortError"));
      this.clearCurrent();
      return;
    }
    if (msg.type === "error") {
      const err = new Error(msg.message);
      (err as Error & { code?: string }).code = msg.code;
      this.currentReject?.(err);
      this.clearCurrent();
      return;
    }
  }

  private armInitTimeout() {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.initTimer = setTimeout(() => {
      this.failCurrent(
        workerError(
          `Vocal model initialisation timed out after ${INIT_INACTIVITY_TIMEOUT_MS / 1000}s with no response from the worker.`,
          "init-timeout",
        ),
      );
    }, INIT_INACTIVITY_TIMEOUT_MS);
  }

  // Rejects the in-flight request and tears the worker down: after a crash or
  // hang its state is unknown, so the next call starts from a fresh worker.
  private failCurrent(err: Error) {
    const reject = this.currentReject;
    this.dispose();
    reject?.(err);
  }

  private clearCurrent() {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    this.currentResolve = null;
    this.currentReject = null;
    this.currentProgress = null;
  }

  private post(message: InboundMessage, transfer?: Transferable[]) {
    this.ensureWorker().postMessage(message, transfer ?? []);
  }

  async init(opts: InitOptions): Promise<void> {
    await new Promise<unknown>((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;
      this.currentProgress = opts.onProgress ?? null;
      this.armInitTimeout();
      this.post({
        type: "init",
        variant: opts.variant,
        forceWasm: opts.forceWasm,
        profile: opts.profile ?? readProfileFlag(),
      });
    });
  }

  async process(opts: ProcessOptions): Promise<ProcessResult> {
    try {
      const result = await new Promise<unknown>((resolve, reject) => {
        this.currentResolve = resolve;
        this.currentReject = reject;
        this.currentProgress = opts.onProgress ?? null;
        // Copy each channel into a fresh buffer before transferring. Transferring
        // the original buffers would detach the caller's Float32Arrays (length
        // -> 0), which then breaks any post-processing in the main thread
        // (e.g. computeInstrumental over decoded.channels).
        const copies = opts.channels.map((c) => new Float32Array(c));
        const transfer = copies.map((c) => c.buffer);
        this.post({ type: "process", channels: copies, totalFrames: opts.totalFrames }, transfer);
      });
      return result as ProcessResult;
    } finally {
      // Tear the worker down after every process(), regardless of outcome.
      // ORT's WebGPU backend keeps a GPU buffer pool tied to the worker's
      // WebGPU device — `session.release()` alone doesn't free it. Terminating
      // the worker destroys the device and reclaims VRAM. The next separate()
      // call pays a small re-init cost (model bytes come from Cache API, only
      // the decode + GPU upload re-runs).
      this.dispose();
    }
  }

  cancel(): void {
    if (!this.worker) return;
    this.post({ type: "cancel" });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.clearCurrent();
  }
}

export { SeparationWorker };
