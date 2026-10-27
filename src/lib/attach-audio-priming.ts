import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { primingCorrectionShift, shiftedSongTimings } from "@/lib/priming-migration";
import { useProjectStore } from "@/stores/project";

// -- Public API ---------------------------------------------------------------

// Nothing was synced against audio new to the project, so its times already match this build's decode.
function adoptPrimingForNewAudio(): void {
  const state = useProjectStore.getState();
  state.setPrimingStripped(true);
  state.setPrimingCorrected(true);
}

// The audio the project was synced against: its times move once, applied to the store as it is after the decode.
async function correctPrimingForProjectAudio(projectId: string, audio: File): Promise<void> {
  const { primingStripped, primingCorrected } = useProjectStore.getState();
  const shift = await primingCorrectionShift(projectId, { primingStripped, primingCorrected }, audio);
  if (shift === null || openProjectIdSnapshot() !== projectId) return;
  const state = useProjectStore.getState();
  if (shift !== 0) {
    const shifted = shiftedSongTimings(state, shift);
    state.setLines(shifted.lines);
    state.setCustomSnapPoints(shifted.customSnapPoints);
    state.setBeatGrid(shifted.beatGrid);
    state.clearHistory();
  }
  adoptPrimingForNewAudio();
}

// -- Exports ------------------------------------------------------------------

export { adoptPrimingForNewAudio, correctPrimingForProjectAudio };
