import { decodePrimingCrop } from "@/audio/decoded-source-audio";
import type { PrimingCrop } from "@/audio/lame-priming";
import type { LyricLine } from "@/domain/line/model";
import { shiftWords } from "@/domain/line/shift";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { type SnapPoint, shiftedSnapPoints } from "@/domain/snap-point/model";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { shiftedGrid } from "@/domain/tempo/grid-edits";
import { readBeatGrid } from "@/domain/tempo/read-beat-grid";
import type { WordTiming } from "@/domain/word/timing";
import { dropSeparatedProjectStems, padImportedMp3Stems } from "@/lib/project-stems";
import type { SavedProject } from "@/lib/saved-project";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[PrimingMigration]";

// -- Helpers ------------------------------------------------------------------

function shiftLine(line: LyricLine, deltaSec: number): LyricLine {
  const next = { ...line } as LyricLine;
  if (isWordSynced(next)) (next as { words: WordTiming[] }).words = shiftWords(next.words!, deltaSec);
  if (isLineSynced(next)) {
    (next as { begin: number; end: number }).begin = Math.max(0, next.begin + deltaSec);
    (next as { begin: number; end: number }).end = Math.max(0, next.end + deltaSec);
  }
  if (next.backgroundWords) next.backgroundWords = shiftWords(next.backgroundWords, deltaSec);
  return next;
}

// -- Public API ---------------------------------------------------------------

function shiftAllTimings(lines: LyricLine[], deltaSec: number): LyricLine[] {
  if (deltaSec === 0) return lines;
  return lines.map((line) => shiftLine(line, deltaSec));
}

// -- Migration ----------------------------------------------------------------

interface SongTimings {
  lines: LyricLine[];
  customSnapPoints: ReadonlyArray<SnapPoint | number>;
  beatGrid: BeatGrid | null;
}

interface ShiftedSongTimings {
  lines: LyricLine[];
  customSnapPoints: SnapPoint[];
  beatGrid: BeatGrid | null;
}

interface PrimingFlags {
  primingStripped?: boolean;
  primingCorrected?: boolean;
}

// Times saved after #117 were synced against the old cut, older ones against no cut. Corrected implies stripped.
function primingMigrationShift(flags: PrimingFlags, crop: PrimingCrop): number {
  if (flags.primingCorrected === true) return 0;
  const syncedCut = flags.primingStripped === true ? crop.beforeSeconds : 0;
  return syncedCut - crop.nowSeconds;
}

function shiftedSongTimings(timings: SongTimings, deltaSec: number): ShiftedSongTimings {
  return {
    lines: shiftAllTimings(timings.lines, deltaSec),
    customSnapPoints: shiftedSnapPoints(timings.customSnapPoints, deltaSec),
    beatGrid: timings.beatGrid && shiftedGrid(timings.beatGrid, deltaSec),
  };
}

function shiftSavedTimings(project: SavedProject, deltaSec: number): void {
  if (deltaSec === 0) return;
  const grid = readBeatGrid(project.beatGrid);
  const shifted = shiftedSongTimings(
    { lines: project.lines ?? [], customSnapPoints: project.customSnapPoints ?? [], beatGrid: grid },
    deltaSec,
  );
  project.lines = shifted.lines;
  if (project.customSnapPoints) project.customSnapPoints = shifted.customSnapPoints;
  if (grid) project.beatGrid = shifted.beatGrid;
}

async function primingCropFor(audio: File): Promise<PrimingCrop | null> {
  try {
    return await decodePrimingCrop(audio);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not decode the project audio; its timings stay as saved", error);
    return null;
  }
}

// Stems left uncorrected only sound early; the project must still open and its times must still move once.
async function correctProjectStems(id: string): Promise<void> {
  try {
    await dropSeparatedProjectStems(id);
    await padImportedMp3Stems(id);
  } catch (error) {
    console.error(LOG_PREFIX, "could not correct the project's stems; they stay as saved", error);
  }
}

// Null leaves the flags as they are; a number is the shift to apply before both flags are set.
async function primingCorrectionShift(
  id: string,
  flags: PrimingFlags,
  audio: File | undefined,
): Promise<number | null> {
  if (!audio || (flags.primingStripped === true && flags.primingCorrected === true)) return null;
  if (flags.primingCorrected === true) return 0;
  const crop = await primingCropFor(audio);
  if (!crop) return null;
  if (crop.beforeSeconds !== crop.nowSeconds) await correctProjectStems(id);
  return primingMigrationShift(flags, crop);
}

async function migratePrimingTimings(id: string, project: SavedProject, audio: File | undefined): Promise<boolean> {
  const flags = { primingStripped: project.primingStripped, primingCorrected: project.primingCorrected };
  const shift = await primingCorrectionShift(id, flags, audio);
  if (shift === null) return false;
  shiftSavedTimings(project, shift);
  project.primingStripped = true;
  project.primingCorrected = true;
  return true;
}

// -- Exports ------------------------------------------------------------------

export {
  migratePrimingTimings,
  primingCorrectionShift,
  primingMigrationShift,
  shiftAllTimings,
  shiftSavedTimings,
  shiftedSongTimings,
};
