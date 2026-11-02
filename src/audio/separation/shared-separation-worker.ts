import type { HtdemucsVariant } from "@/audio/separation/model-registry";
import { RoformerWorker } from "@/audio/separation/roformer/worker-host";
import type { VocalSeparator } from "@/audio/separation/vocal-separator";
import { SeparationWorker } from "@/audio/separation/worker-host";
import type { VocalModelVariant } from "@/stores/settings";

let worker: SeparationWorker | null = null;
let roformer: RoformerWorker | null = null;

function getSeparationWorker(): SeparationWorker {
  if (!worker) worker = new SeparationWorker();
  return worker;
}

function getRoformerWorker(): RoformerWorker {
  if (!roformer) roformer = new RoformerWorker();
  return roformer;
}

function htdemucsSeparator(variant: HtdemucsVariant): VocalSeparator {
  return {
    init: (onProgress) => getSeparationWorker().init({ variant, onProgress }),
    process: (opts) => getSeparationWorker().process(opts),
  };
}

function getVocalSeparator(variant: VocalModelVariant): VocalSeparator {
  return variant === "roformer" ? getRoformerWorker() : htdemucsSeparator(variant);
}

function cancelSeparationWorker(): void {
  worker?.cancel();
  roformer?.cancel();
}

// The RoFormer keeps its sessions for the next song; only its run is stopped.
function disposeSeparationWorker(): void {
  roformer?.cancel();
  if (worker) {
    worker.dispose();
    worker = null;
  }
}

/** Frees the RoFormer's memory unless it's separating; another model is about to load, or it was deselected. */
async function releaseIdleRoformer(): Promise<void> {
  await roformer?.releaseIfIdle();
  await roformer?.settled();
}

export { cancelSeparationWorker, disposeSeparationWorker, getVocalSeparator, releaseIdleRoformer };
