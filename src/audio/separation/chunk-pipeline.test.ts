import { runChunkPipeline } from "@/audio/separation/chunk-pipeline";
import { SEGMENT_SAMPLES } from "@/audio/separation/chunker";
import type { Ort, OrtSession, OrtTensor } from "@/audio/separation/ort-runtime";
import { describe, expect, it } from "vitest";

// Two chunks: one full segment plus a short tail.
const TOTAL_FRAMES = SEGMENT_SAMPLES + 1000;

class FakeTensor {
  constructor(
    readonly type: string,
    readonly data: Float32Array,
    readonly dims: number[],
  ) {}
}
const fakeRuntime = { Tensor: FakeTensor, env: {} } as unknown as Ort;

function validOutputs(): Record<string, OrtTensor> {
  return {
    output: { data: new Float32Array(4 * 4 * 2048 * 336), dims: [] },
    add_67: { data: new Float32Array(4 * 2 * SEGMENT_SAMPLES), dims: [] },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) await tick();
  expect(condition()).toBe(true);
}

function makeOptions(session: OrtSession, isCancelled: () => boolean) {
  const channels = [new Float32Array(TOTAL_FRAMES), new Float32Array(TOTAL_FRAMES)];
  return {
    session,
    runtime: fakeRuntime,
    channels,
    totalChunks: 2,
    backend: "wasm" as const,
    profileGpu: false,
    adapterHasTimestampQuery: null,
    isCancelled,
    onProgress: () => {},
  };
}

describe("runChunkPipeline", () => {
  it("settles the in-flight run before reporting cancellation", async () => {
    const second = deferred<Record<string, OrtTensor>>();
    let runs = 0;
    const session: OrtSession = {
      inputNames: [],
      outputNames: [],
      run: () => (++runs === 1 ? Promise.resolve(validOutputs()) : second.promise),
    };
    // Not cancelled at the first loop check, cancelled at the second, while
    // run #2 is still executing.
    let checks = 0;
    const promise = runChunkPipeline(makeOptions(session, () => ++checks > 1));
    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await waitFor(() => runs === 2 && checks >= 2);
    await tick();
    expect(settled).toBe(false);

    second.resolve(validOutputs());
    expect(await promise).toEqual({ status: "cancelled" });
  });

  it("settles the in-flight run before throwing on a bad output", async () => {
    const second = deferred<Record<string, OrtTensor>>();
    let runs = 0;
    const session: OrtSession = {
      inputNames: [],
      outputNames: [],
      // Run #1 returns tensors without the expected output names.
      run: () => (++runs === 1 ? Promise.resolve({}) : second.promise),
    };
    const promise = runChunkPipeline(makeOptions(session, () => false));
    let settled = false;
    promise.catch(() => {
      settled = true;
    });

    await waitFor(() => runs === 2);
    await tick();
    expect(settled).toBe(false);

    second.resolve(validOutputs());
    await expect(promise).rejects.toThrow("Missing output tensor");
  });

  it("returns every chunk when not cancelled", async () => {
    const session: OrtSession = {
      inputNames: [],
      outputNames: [],
      run: () => Promise.resolve(validOutputs()),
    };
    const result = await runChunkPipeline(makeOptions(session, () => false));
    expect(result.status).toBe("done");
    if (result.status === "done") expect(result.chunks).toHaveLength(2);
  });
});
