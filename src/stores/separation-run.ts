import { hubertfaAligner } from "@/audio/alignment/hubertfa/hubertfa-aligner";
import { probeRoformerSupport } from "@/audio/separation/roformer/availability";
import { getVocalSeparator, releaseIdleRoformer } from "@/audio/separation/shared-separation-worker";
import { isProjectStemJobKey } from "@/audio/separation/stem-job-liveness";
import { stemJobKey } from "@/audio/separation/stem-store";
import type { SeparationError, SeparationStatus, Stem } from "@/audio/separation/types";
import { STEM_SLOTS } from "@/domain/stems/stem-slot";
import type { AudioSource } from "@/stores/audio";
import { storeSeparatedStems } from "@/stores/separated-stem-write";
import { runModelDownload } from "@/stores/separation-model-download";
import { separateSongFile } from "@/stores/separation-pipeline";
import { type VocalModelVariant, useSettingsStore } from "@/stores/settings";
import { songKeyFor } from "@/stores/stem-sources";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface RunState {
  status: SeparationStatus;
  error: SeparationError | null;
  progress: { loaded: number; total: number };
  modelCached: boolean;
  jobKey: string | null;
  stemUrls: Partial<Record<Stem, string>>;
}

interface SeparationRun {
  /** The model the user picked; a fallback runs another. */
  selected: VocalModelVariant;
  file: File;
  source: AudioSource;
  projectId: string | undefined;
  set: (partial: Partial<RunState>) => void;
  get: () => RunState;
  isCurrentRun: () => boolean;
  isCancelling: () => boolean;
}

// -- Constants ----------------------------------------------------------------

/** What runs when the RoFormer can't: the default HTDemucs build. */
const FALLBACK_VARIANT = "fp16" satisfies VocalModelVariant;
const LOG_PREFIX = "[Separation]";
// A worker's memory is freed a few seconds after it ends; the RoFormer waits that long before loading.
const ALIGNER_SETTLE_MS = 5_000;

// -- Functions ----------------------------------------------------------------

// A kept alignment model holds the GPU buffers of its last run, which beside the RoFormer pass the memory a browser
// gets. It reloads on the next align. The store is loaded lazily: it imports the separation store.
async function releaseKeptAligner(): Promise<void> {
  if (!useSettingsStore.getState().keepAlignmentModelLoaded) return;
  const { useAlignmentStore } = await import("@/stores/alignment");
  const { status } = useAlignmentStore.getState();
  if (status === "running" || status === "downloading") return;
  hubertfaAligner.release();
  await new Promise((resolve) => setTimeout(resolve, ALIGNER_SETTLE_MS));
}

// Resolves true once stems were written (or writing them failed and said so), false if the run stopped or failed.
async function separateWith(variant: VocalModelVariant, run: SeparationRun): Promise<boolean> {
  const { set, get, isCurrentRun } = run;
  const separator = getVocalSeparator(variant);
  if (variant === "roformer") await releaseKeptAligner();
  if (!(await runModelDownload(set, separator, run.isCancelling))) return false;
  if (!isCurrentRun()) return false;
  if (variant === run.selected) set({ modelCached: true });
  const separated = await separateSongFile(run.file, {
    separator,
    variant,
    set,
    isCurrentRun,
    isCancelling: run.isCancelling,
    onHashed: (cacheHash) => {
      if (!isProjectStemJobKey(get().jobKey)) set({ jobKey: stemJobKey(cacheHash, variant) });
    },
  });
  if (!separated || !isCurrentRun()) return false;
  try {
    await storeSeparatedStems({
      cacheHash: separated.cacheHash,
      songKey: songKeyFor(run.source, separated.audioHash),
      variant,
      files: separated.stemFiles,
      durationSeconds: separated.durationSeconds,
      projectId: isProjectStemJobKey(get().jobKey) ? run.projectId : undefined,
      emptySlots: STEM_SLOTS.filter((slot) => !get().stemUrls[slot]),
    });
  } catch (err) {
    if (isCurrentRun()) set({ status: "error", error: { code: "unknown", message: (err as Error).message } });
  }
  return true;
}

/** The model that will run for a choice: the RoFormer only where WebGPU has shader-f16. */
async function runnableModel(selected: VocalModelVariant): Promise<VocalModelVariant> {
  if (selected !== "roformer") return selected;
  const support = await probeRoformerSupport();
  if (support.supported) return selected;
  toast.warning("High quality vocals can't run here, so the standard vocal model is separating this song.", {
    description: support.reason,
  });
  return FALLBACK_VARIANT;
}

// The RoFormer can run out of GPU memory or lose its device partway through; the song is then separated again with
// HTDemucs, so a failed run costs time but never leaves the user without stems.
/** The model to run after `variant` ended without stems: HTDemucs after a RoFormer failure, otherwise none. */
function fallbackModel(
  variant: VocalModelVariant,
  status: SeparationStatus,
  stopped: boolean,
): VocalModelVariant | null {
  return variant === "roformer" && status === "error" && !stopped ? FALLBACK_VARIANT : null;
}

async function runSeparation(run: SeparationRun): Promise<boolean> {
  // An upgrade of stems the song already has: if the RoFormer fails, they stay, and so does its error.
  const hadStems = STEM_SLOTS.every((slot) => run.get().stemUrls[slot]);
  const variant = await runnableModel(run.selected);
  if (await separateWith(variant, run)) return true;
  const { error, status } = run.get();
  const fallback = hadStems ? null : fallbackModel(variant, status, !run.isCurrentRun() || run.isCancelling());
  if (!fallback) return false;
  console.warn(LOG_PREFIX, "the RoFormer failed; separating with HTDemucs", error);
  toast.warning("High quality vocals failed, so the standard vocal model is separating this song.", {
    description: error?.message,
  });
  run.set({ error: null, status: "downloading", progress: { loaded: 0, total: 0 } });
  await releaseIdleRoformer();
  if (!run.isCurrentRun() || run.isCancelling()) return false;
  return separateWith(fallback, run);
}

// -- Exports ------------------------------------------------------------------

export { runSeparation };
