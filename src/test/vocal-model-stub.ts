import { SeparationWorker } from "@/audio/separation/worker-host";
import { vi } from "vitest";

// -- Types --------------------------------------------------------------------

type ProcessResult = Awaited<ReturnType<SeparationWorker["process"]>>;

// -- Constants ----------------------------------------------------------------

const ENCODE_SECONDS = 60;

// -- Helpers ------------------------------------------------------------------

// The vocal model needs an 85 MB download, so these tests stand in for it at the worker boundary only.
function stubVocalModel(): { finishNextRun: (vocals?: Float32Array[]) => void } {
  const pending: Array<(result: ProcessResult) => void> = [];
  vi.spyOn(SeparationWorker.prototype, "init").mockResolvedValue(undefined);
  vi.spyOn(SeparationWorker.prototype, "process").mockImplementation(
    () => new Promise<ProcessResult>((resolve) => pending.push(resolve)),
  );
  return {
    finishNextRun: (vocals) => {
      const frames = ENCODE_SECONDS * 44_100;
      const channels = vocals ?? [new Float32Array(frames), new Float32Array(frames)];
      pending.shift()?.({ vocals: channels, numChannels: channels.length, totalFrames: frames });
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { stubVocalModel };
