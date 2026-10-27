import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { primingCorrectionShift, repairProjectStems, shiftedSongTimings } from "@/lib/priming-migration";
import { useProjectStore } from "@/stores/project";

// -- Module state -------------------------------------------------------------

const corrections = new Map<string, Promise<void>>();

// -- Public API ---------------------------------------------------------------

// Nothing was synced against audio new to the project, so its times already match this build's decode.
function adoptPrimingForNewAudio(): void {
  const state = useProjectStore.getState();
  state.setPrimingStripped(true);
  state.setPrimingCorrected(true);
}

async function correctOnce(projectId: string, audio: File): Promise<void> {
  const { primingStripped, primingCorrected } = useProjectStore.getState();
  const shift = await primingCorrectionShift({ primingStripped, primingCorrected }, audio);
  await repairProjectStems(projectId, audio);
  if (shift === null || openProjectIdSnapshot() !== projectId) return;
  const state = useProjectStore.getState();
  if (state.primingCorrected) return;
  if (shift !== 0) {
    const shifted = shiftedSongTimings(state, shift);
    state.setLines(shifted.lines);
    state.setCustomSnapPoints(shifted.customSnapPoints);
    state.setBeatGrid(shifted.beatGrid);
    state.clearHistory();
  }
  adoptPrimingForNewAudio();
}

// The audio the project was synced against: its times move once, applied to the store as it is after the decode.
// Corrections of one project run one at a time, so a second one sees the flags the first one set.
function correctPrimingForProjectAudio(projectId: string, audio: File): Promise<void> {
  const run = () => correctOnce(projectId, audio);
  const correcting = (corrections.get(projectId) ?? Promise.resolve()).then(run, run);
  corrections.set(projectId, correcting);
  const forget = () => {
    if (corrections.get(projectId) === correcting) corrections.delete(projectId);
  };
  correcting.then(forget, forget);
  return correcting;
}

// -- Exports ------------------------------------------------------------------

export { adoptPrimingForNewAudio, correctPrimingForProjectAudio };
