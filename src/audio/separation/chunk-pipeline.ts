import { type Chunk, SEGMENT_SAMPLES, iterateChunks } from "@/audio/separation/chunker";
import { extractVocalsStem } from "@/audio/separation/demucs-postprocess";
import { MAGSPEC_DIMS, computeMagspec } from "@/audio/separation/demucs-spec";
import { reportKernelProfile, startKernelProfile, stopKernelProfile } from "@/audio/separation/gpu-profile";
import type { Backend, Ort, OrtSession, OrtTensor } from "@/audio/separation/ort-runtime";
import { log } from "@/audio/separation/worker-log";

// HTDemucs ONNX I/O contract (matches sevagh/demucs.onnx export):
//   inputs:
//     "input": [1, 2, 343980]      stereo waveform @ 44.1 kHz, 7.8 s
//     "x":     [1, 4, 2048, 336]   pre-computed magspec (L_re, L_im, R_re, R_im)
//   outputs:
//     "output": [1, 4, 4, 2048, 336]  separated spectrogram branch
//     "add_67": [1, 4, 2, 343980]     separated time branch
//                                     stem order: drums, bass, other, vocals
const FREQ_OUTPUT_NAME = "output";
const TIME_OUTPUT_NAME = "add_67";
const WAVEFORM_INPUT_NAME = "input";
const MAGSPEC_INPUT_NAME = "x";

interface PreparedChunk {
  chunk: Chunk;
  feeds: Record<string, OrtTensor>;
}

interface PipelineOptions {
  session: OrtSession;
  runtime: Ort;
  channels: Float32Array[];
  totalChunks: number;
  backend: Backend;
  /** Profile one mid-run chunk's GPU kernels (WebGPU only). */
  profileGpu: boolean;
  adapterHasTimestampQuery: boolean | null;
  isCancelled: () => boolean;
  onProgress: (processed: number, total: number) => void;
}

type PipelineResult = { status: "done"; chunks: Chunk[] } | { status: "cancelled" };

// Builds both model inputs for a chunk (CPU-only; includes the STFT).
function prepareChunk(runtime: Ort, chunk: Chunk): PreparedChunk {
  // "input" waveform tensor: [1, 2, 343980], laid out [L..., R...].
  const waveformFlat = new Float32Array(2 * SEGMENT_SAMPLES);
  waveformFlat.set(chunk.data[0], 0);
  waveformFlat.set(chunk.data[1], SEGMENT_SAMPLES);
  // "x" magspec tensor: [1, 4, 2048, 336].
  const magspecFlat = computeMagspec(chunk.data);
  return {
    chunk,
    feeds: {
      [WAVEFORM_INPUT_NAME]: new runtime.Tensor("float32", waveformFlat, [1, 2, SEGMENT_SAMPLES]),
      [MAGSPEC_INPUT_NAME]: new runtime.Tensor("float32", magspecFlat, [...MAGSPEC_DIMS]),
    },
  };
}

// Software-pipelined: the CPU work (STFT for the next chunk, iSTFT for the
// previous one) runs while the GPU is busy with the current inference call,
// instead of the GPU idling through each chunk's pre/post-processing.
//   run(i) ‖ prepare(i+1)  →  await run(i)  →  start run(i+1) ‖ extract(i)
// Only one session.run is ever in flight; ORT does not allow concurrent runs.
// Throws on any inference or tensor failure; the caller reports it.
async function runChunkPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const { session, runtime, backend } = opts;
  const chunks = iterateChunks(opts.channels);
  const prepareNext = (): PreparedChunk | null => {
    const next = chunks.next();
    return next.done ? null : prepareChunk(runtime, next.value);
  };

  // Profile the 3rd run (after shader warm-up), or the last one for short audio.
  const profileChunk = opts.profileGpu && backend === "webgpu" ? Math.min(2, opts.totalChunks - 1) : -1;
  let runsStarted = 0;
  const startRun = (prepared: PreparedChunk): Promise<Record<string, OrtTensor>> => {
    if (runsStarted === profileChunk) startKernelProfile(runtime.env);
    runsStarted++;
    // Time to *return* the promise: the CPU-side submit cost of a run.
    const submitStart = performance.now();
    const run = session.run(prepared.feeds);
    submitMs += performance.now() - submitStart;
    // If we bail out before awaiting this run (cancel/error), don't leave an
    // unhandled rejection behind. The caller's own await still sees the error.
    run.catch(() => {});
    return run;
  };

  // Timing. The worker is single-threaded, so each moment is either CPU work
  // (prepare/extract) or awaiting inference. `waitMs` is the time spent blocked
  // on a run that outlasted the CPU work: large = GPU-bound, ~0 = CPU-bound
  // (the GPU idles between runs).
  let prepareMs = 0;
  let extractMs = 0;
  let waitMs = 0;
  let submitMs = 0;
  const startedAt = performance.now();
  const timed = <T>(fn: () => T, add: (ms: number) => void): T => {
    const t = performance.now();
    try {
      return fn();
    } finally {
      add(performance.now() - t);
    }
  };
  const prepareTimed = () =>
    timed(prepareNext, (ms) => {
      prepareMs += ms;
    });

  const vocalChunks: Chunk[] = [];
  const first = prepareTimed();
  let inFlight: { prepared: PreparedChunk; run: Promise<Record<string, OrtTensor>> } | null = first
    ? { prepared: first, run: startRun(first) }
    : null;

  let chunkIndex = 0;
  try {
    while (inFlight) {
      if (opts.isCancelled()) return { status: "cancelled" };

      const next = prepareTimed();
      const waitStart = performance.now();
      const result = await inFlight.run;
      const chunkWaitMs = performance.now() - waitStart;
      waitMs += chunkWaitMs;
      if (chunkIndex === profileChunk) stopKernelProfile(runtime.env);
      const finished = inFlight.prepared.chunk;
      inFlight = next ? { prepared: next, run: startRun(next) } : null;

      const timeTensor = result[TIME_OUTPUT_NAME];
      const freqTensor = result[FREQ_OUTPUT_NAME];
      if (!timeTensor || !freqTensor) {
        throw new Error(
          `Missing output tensor ${!timeTensor ? TIME_OUTPUT_NAME : FREQ_OUTPUT_NAME}. Available: ${Object.keys(result).join(", ")}`,
        );
      }
      const vocals = timed(
        () => extractVocalsStem(timeTensor, freqTensor),
        (ms) => {
          extractMs += ms;
        },
      );
      vocalChunks.push({ start: finished.start, end: finished.end, data: vocals });
      if (chunkIndex === profileChunk) {
        await reportKernelProfile(chunkIndex + 1, chunkWaitMs, opts.adapterHasTimestampQuery);
      }

      chunkIndex++;
      opts.onProgress(chunkIndex, opts.totalChunks);
    }
  } finally {
    // ORT sessions don't allow concurrent runs, and run(i+1) is started before
    // chunk i is extracted. On cancel or error, let any run still in flight
    // settle before returning or throwing so the session is idle afterwards.
    if (profileChunk >= 0) stopKernelProfile(runtime.env);
    if (inFlight) await inFlight.run.catch(() => {});
  }

  const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  const cpuMs = prepareMs + extractMs;
  log(
    [
      `processed ${vocalChunks.length} chunks on ${backend} in ${sec(performance.now() - startedAt)}`,
      `CPU busy ${sec(cpuMs)} (STFT ${sec(prepareMs)}, iSTFT ${sec(extractMs)})`,
      `run() submit ${sec(submitMs)}`,
      `waiting on inference ${sec(waitMs)} => ${waitMs < cpuMs * 0.25 ? "CPU-bound" : "GPU/inference-bound"}`,
    ].join(", "),
  );
  return { status: "done", chunks: vocalChunks };
}

export { runChunkPipeline };
