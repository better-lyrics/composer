import { settingEntry } from "@/stores/settings-catalog";
import { TARGET_SAMPLE_RATE, decodeFileToFloat32, hashFile } from "@/audio/separation/audio-codec";
import { encodeSeparatedStems } from "@/audio/separation/separated-stems";
import { getSeparationWorker } from "@/audio/separation/shared-separation-worker";
import { stemCacheHash } from "@/audio/separation/stem-store";
import type { SeparationError, SeparationStatus } from "@/audio/separation/types";
import { hasOnlyFiniteSamples } from "@/audio/separation/validate-channels";
import type { SeparationWorker } from "@/audio/separation/worker-host";

// -- Types --------------------------------------------------------------------

interface PipelineState {
  status: SeparationStatus;
  error: SeparationError | null;
  progress: { loaded: number; total: number };
}

interface PipelineRun {
  set: (partial: Partial<PipelineState>) => void;
  isCurrentRun: () => boolean;
  isCancelling: () => boolean;
  onHashed: (cacheHash: string) => void;
}

interface SeparatedSong {
  audioHash: string;
  cacheHash: string;
  stemFiles: Awaited<ReturnType<typeof encodeSeparatedStems>>;
  durationSeconds: number;
}

// -- Pipeline -----------------------------------------------------------------

// Decodes, separates and encodes one song. Resolves null once the run is stale, cancelled or has failed;
// a failure has already been written to the store.
async function separateSongFile(file: File, run: PipelineRun): Promise<SeparatedSong | null> {
  run.set({ status: "processing", progress: { loaded: 0, total: 0 } });
  let decoded: Awaited<ReturnType<typeof decodeFileToFloat32>>;
  try {
    decoded = await decodeFileToFloat32(file);
  } catch (err) {
    if (!run.isCurrentRun()) return null;
    run.set({ status: "error", error: { code: "decode-failed", message: (err as Error).message } });
    return null;
  }

  const audioHash = await hashFile(file);
  const cacheHash = await stemCacheHash(file, audioHash);
  if (!run.isCurrentRun()) return null;
  run.onHashed(cacheHash);

  let result: Awaited<ReturnType<SeparationWorker["process"]>>;
  try {
    result = await getSeparationWorker().process({
      channels: decoded.channels,
      totalFrames: decoded.numFrames,
      onProgress: (processed, total) => {
        if (run.isCurrentRun()) run.set({ progress: { loaded: processed, total } });
      },
    });
  } catch (err) {
    if (!run.isCurrentRun()) return null;
    if ((err as Error).name === "AbortError" || run.isCancelling()) {
      run.set({ status: "idle" });
      return null;
    }
    run.set({ status: "error", error: { code: "ort-failed", message: (err as Error).message } });
    return null;
  }
  if (!run.isCurrentRun()) return null;

  if (!hasOnlyFiniteSamples(result.vocals)) {
    run.set({
      status: "error",
      error: {
        code: "ort-failed",
        message: `The vocal model returned invalid audio samples. Switch ${settingEntry("vocalModelVariant").label} to fp32 and run separation again.`,
      },
    });
    return null;
  }

  let stemFiles: Awaited<ReturnType<typeof encodeSeparatedStems>>;
  try {
    stemFiles = await encodeSeparatedStems(decoded.channels, result.vocals, TARGET_SAMPLE_RATE);
  } catch (err) {
    if (!run.isCurrentRun()) return null;
    run.set({ status: "error", error: { code: "unknown", message: (err as Error).message } });
    return null;
  }
  return { audioHash, cacheHash, stemFiles, durationSeconds: decoded.numFrames / TARGET_SAMPLE_RATE };
}

// -- Exports ------------------------------------------------------------------

export { separateSongFile };
