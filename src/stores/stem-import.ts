import { decodeAudioToWav, needsWavConversion } from "@/audio/audio-decode";
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
import { isQuotaExceededError } from "@/lib/storage-signals";
import { type AudioSource, playableFile, useAudioStore } from "@/stores/audio";
import { songKeyFor } from "@/stores/stem-sources";

// -- Types --------------------------------------------------------------------

interface StemImportTarget {
  source: AudioSource;
  projectId: string | undefined;
  slot: StemSlot;
  token: number;
}

interface PendingStemImport {
  slot: StemSlot;
  file: File;
  durationSeconds: number;
  mismatchSeconds: number;
  target: StemImportTarget;
}

interface StemImportError {
  slot: StemSlot;
  message: string;
}

interface StemImportState {
  pendingImport: PendingStemImport | null;
  importError: StemImportError | null;
}

interface ReadyStemImport {
  durationSeconds: number;
  target: StemImportTarget;
}

type SetStemImportState = (partial: Partial<StemImportState>) => void;

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StemImport]";

// -- Module state -------------------------------------------------------------

const latestImports = new Map<StemSlot, number>();
let importCount = 0;

// -- Target -------------------------------------------------------------------

function beginImport(slot: StemSlot): StemImportTarget {
  importCount += 1;
  latestImports.set(slot, importCount);
  return { source: useAudioStore.getState().source, projectId: openProjectIdSnapshot(), slot, token: importCount };
}

// An import belongs to the song and project it started in, and only the newest import into a slot may save.
function isCurrentImportTarget(target: StemImportTarget): boolean {
  return (
    latestImports.get(target.slot) === target.token &&
    useAudioStore.getState().source === target.source &&
    openProjectIdSnapshot() === target.projectId
  );
}

function saveFailureMessage(file: File, error: unknown): string {
  if (isQuotaExceededError(error)) return `Unable to save ${file.name}. Free up storage space and try again.`;
  return `Unable to save ${file.name}. Import it again.`;
}

// The song plays from a priming-stripped WAV when it is mp3 or raw aac; its stems must play the same way to stay in step.
async function seekableStem(file: File): Promise<File> {
  if (!needsWavConversion(file)) return file;
  return new File([await decodeAudioToWav(file)], file.name, { type: "audio/wav" });
}

// -- Import -------------------------------------------------------------------

// Resolves when the stem can be stored right away; otherwise records why not and resolves null.
async function prepareStemImport(slot: StemSlot, file: File, set: SetStemImportState): Promise<ReadyStemImport | null> {
  const target = beginImport(slot);
  set({ pendingImport: null, importError: null });
  if (!isSupportedAudioFile(file)) {
    set({ importError: { slot, message: UNSUPPORTED_AUDIO_FILE_MESSAGE } });
    return null;
  }
  const song = playableFile(target.source);
  if (!song) return null;
  const [probe, songProbe] = await Promise.all([probeAudioFile(file), probeAudioFile(song)]);
  if (!isCurrentImportTarget(target)) return null;
  if (!probe.ok) {
    set({ importError: { slot, message: `Unable to read ${file.name}. Use ${AUDIO_FORMATS_PROSE}.` } });
    return null;
  }
  const mismatchSeconds = stemDurationMismatch(probe.duration, songProbe.ok ? songProbe.duration : 0);
  if (mismatchSeconds === null) return { durationSeconds: probe.duration, target };
  set({ pendingImport: { slot, file, durationSeconds: probe.duration, mismatchSeconds, target } });
  return null;
}

async function commitStemImport(
  slot: StemSlot,
  file: File,
  { durationSeconds, target }: ReadyStemImport,
  set: SetStemImportState,
): Promise<boolean> {
  const song = playableFile(target.source);
  if (!song || !isCurrentImportTarget(target)) return false;
  try {
    const audioHash = await hashFile(song);
    if (!isCurrentImportTarget(target)) return false;
    const playable = await seekableStem(file);
    if (!isCurrentImportTarget(target)) return false;
    const projectId = target.projectId ?? (await ensureOpenProjectId());
    await saveProjectStem(projectId, songKeyFor(target.source, audioHash), {
      slot,
      file: playable,
      origin: "imported",
      durationSeconds,
    });
    return true;
  } catch (error) {
    console.error(LOG_PREFIX, "could not store the imported stem", error);
    set({ importError: { slot, message: saveFailureMessage(file, error) } });
    return false;
  }
}

async function removeProjectStem(slot: StemSlot, set: SetStemImportState): Promise<void> {
  const projectId = openProjectIdSnapshot();
  if (!projectId) return;
  try {
    await deleteProjectStem(projectId, slot);
  } catch (error) {
    console.error(LOG_PREFIX, "could not remove the stem", error);
    set({ importError: { slot, message: `Unable to remove the ${slot} stem. Try again.` } });
  }
}

// -- Exports ------------------------------------------------------------------

export { commitStemImport, prepareStemImport, removeProjectStem };
export type { StemImportState };
