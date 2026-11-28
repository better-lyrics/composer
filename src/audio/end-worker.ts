import { type Ort, type OrtSession, releaseWebGpu } from "@/audio/ort-runtime";

// -- Types --------------------------------------------------------------------

/** Asks a model worker to free its GPU before it's terminated; it answers with a `ShutdownReply`. */
interface ShutdownRequest {
  type: "shutdown";
}

interface ShutdownReply {
  type: "shut-down";
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[end-worker]";
// Long enough for the GPU to finish what it was given. After this the next model may start; the worker is still
// terminated, but only once it answers.
const SHUTDOWN_WAIT_MS = 10_000;

// -- Functions ----------------------------------------------------------------

/**
 * Stops a model worker, and terminates it once it has destroyed its WebGPU device (see `releaseWebGpu`). Terminating a
 * worker the GPU may still answer can deadlock the whole tab in Chrome 152 to 158 (crbug.com/574515421), so a worker
 * is never terminated before it answers: one that doesn't answer keeps its memory until the page reloads, which beats
 * a frozen tab. Resolves once the worker has ended, or after `SHUTDOWN_WAIT_MS` if it hasn't answered by then.
 */
function endWorkerCleanly(worker: Worker): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(LOG_PREFIX, "a model worker hasn't freed its GPU yet; it ends when it does");
      resolve();
    }, SHUTDOWN_WAIT_MS);
    worker.addEventListener("message", (ev: MessageEvent<{ type?: unknown }>) => {
      if (ev.data?.type !== "shut-down") return;
      clearTimeout(timer);
      worker.terminate();
      resolve();
    });
    // Every model worker reads `cancel` as "stop what you're doing", so the shutdown doesn't wait on a whole run.
    worker.postMessage({ type: "cancel" });
    worker.postMessage({ type: "shutdown" } satisfies ShutdownRequest);
  });
}

/** In a model worker: frees the GPU, then tells the host the worker can be terminated. */
async function answerShutdown(
  runtime: Ort | null,
  sessions: readonly (OrtSession | null)[],
  post: (reply: ShutdownReply) => void,
): Promise<void> {
  await releaseWebGpu(runtime, sessions);
  post({ type: "shut-down" });
}

// -- Exports ------------------------------------------------------------------

export { answerShutdown, endWorkerCleanly };
export type { ShutdownReply, ShutdownRequest };
