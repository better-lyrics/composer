import { hashFile } from "@/audio/separation/audio-codec";
import { probeAudioFile } from "@/audio/probe-audio-file";
import {
  AUDIO_FORMATS_PROSE,
  UNSUPPORTED_AUDIO_FILE_MESSAGE,
  isSupportedAudioFile,
} from "@/domain/audio-file/supported-formats";
import { stemDurationMismatch } from "@/domain/stems/duration-match";
import type { StemSlot } from "@/domain/stems/stem-slot";
import { ensureOpenProjectId, openProjectIdSnapshot } from "@/lib/open-project-session";
import { deleteProjectStem, saveProjectStem } from "@/lib/project-stems";
import { playableFile, useAudioStore } from "@/stores/audio";

// -- Types --------------------------------------------------------------------

interface PendingStemImport {
  slot: StemSlot;
  file: File;
  durationSeconds: number;
  mismatchSeconds: number;
}

interface StemImportError {
  slot: StemSlot;
  message: string;
}

interface StemImportState {
  pendingImport: PendingStemImport | null;
  importError: StemImportError | null;
}

type SetStemImportState = (partial: Partial<StemImportState>) => void;

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StemImport]";

// -- Import -------------------------------------------------------------------

// Resolves the stem's duration when it can be stored right away; otherwise records why not and resolves null.
async function prepareStemImport(slot: StemSlot, file: File, set: SetStemImportState): Promise<number | null> {
  set({ pendingImport: null, importError: null });
  if (!isSupportedAudioFile(file)) {
    set({ importError: { slot, message: UNSUPPORTED_AUDIO_FILE_MESSAGE } });
    return null;
  }
  const song = playableFile(useAudioStore.getState().source);
  if (!song) return null;
  const [probe, songProbe] = await Promise.all([probeAudioFile(file), probeAudioFile(song)]);
  if (!probe.ok) {
    set({ importError: { slot, message: `Unable to read ${file.name}. Use ${AUDIO_FORMATS_PROSE}.` } });
    return null;
  }
  const songSeconds = songProbe.ok ? songProbe.duration : 0;
  const mismatchSeconds = stemDurationMismatch(probe.duration, songSeconds);
  if (mismatchSeconds === null) return probe.duration;
  set({ pendingImport: { slot, file, durationSeconds: probe.duration, mismatchSeconds } });
  return null;
}

async function commitStemImport(
  slot: StemSlot,
  file: File,
  durationSeconds: number,
  set: SetStemImportState,
): Promise<boolean> {
  const song = playableFile(useAudioStore.getState().source);
  if (!song) return false;
  try {
    const [projectId, songHash] = await Promise.all([ensureOpenProjectId(), hashFile(song)]);
    await saveProjectStem(projectId, songHash, { slot, file, origin: "imported", durationSeconds });
    return true;
  } catch (error) {
    console.error(LOG_PREFIX, "could not store the imported stem", error);
    set({ importError: { slot, message: `Unable to save ${file.name}. Free up storage space and try again.` } });
    return false;
  }
}

async function removeProjectStem(slot: StemSlot): Promise<void> {
  const projectId = openProjectIdSnapshot();
  if (!projectId) return;
  try {
    await deleteProjectStem(projectId, slot);
  } catch (error) {
    console.error(LOG_PREFIX, "could not remove the stem", error);
  }
}

// -- Exports ------------------------------------------------------------------

export { commitStemImport, prepareStemImport, removeProjectStem };
export type { PendingStemImport, StemImportError, StemImportState };
