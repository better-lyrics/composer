import { decodePrimingCrop } from "@/audio/decoded-source-audio";
import type { PrimingCrop } from "@/audio/lame-priming";
import type { LineTrack, LyricLine } from "@/domain/line/model";
import { shiftWords } from "@/domain/line/shift";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import { withBackgroundTrack, withMainTrack, withTrackSpan, withTrackWords } from "@/domain/line/track-writes";
import { type SnapPoint, shiftedSnapPoints } from "@/domain/snap-point/model";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { shiftedGrid } from "@/domain/tempo/grid-edits";
import { readBeatGrid } from "@/domain/tempo/read-beat-grid";
import {
  type SeparatedStemRepair,
  hasStemsToRepair,
  hasUncheckedSeparatedStems,
  loadProjectStems,
  repairOldProjectStems,
} from "@/lib/project-stems";
import type { SavedProjectStems } from "@/domain/stems/saved-stems";
import { type SavedProject, linesFromSaved, savedLines } from "@/lib/saved-project";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[PrimingMigration]";

// -- Helpers ------------------------------------------------------------------

function shiftedTrack<T extends LineTrack>(track: T, deltaSec: number): T {
  if (isSpanTimed(track)) {
    return withTrackSpan(track, Math.max(0, track.begin + deltaSec), Math.max(0, track.end + deltaSec));
  }
  const words = timedSyllables(track);
  return words.length > 0 ? withTrackWords(track, shiftWords(words, deltaSec)) : track;
}

function shiftLine(line: LyricLine, deltaSec: number): LyricLine {
  const background = backgroundTrack(line);
  const shifted = withMainTrack(line, shiftedTrack(mainTrack(line), deltaSec));
  return background ? withBackgroundTrack(shifted, shiftedTrack(background, deltaSec)) : shifted;
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
    { lines: linesFromSaved(project.lines ?? []), customSnapPoints: project.customSnapPoints ?? [], beatGrid: grid },
    deltaSec,
  );
  project.lines = savedLines(shifted.lines);
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

// Only stems left unchecked by an earlier open decode the song, and only to decide on separated ones.
async function separatedStemRepair(stems: SavedProjectStems, audio: File | undefined): Promise<SeparatedStemRepair> {
  if (!audio || !hasUncheckedSeparatedStems(stems)) return "undecided";
  const crop = await primingCropFor(audio);
  if (!crop) return "undecided";
  return crop.beforeSeconds !== crop.nowSeconds ? "drop" : "keep";
}

// Runs on every open until it succeeds; a failure leaves the stems unchecked and the project still opens.
async function repairProjectStems(id: string, audio: File | undefined): Promise<void> {
  try {
    const stems = await loadProjectStems(id);
    if (!stems || !hasStemsToRepair(stems)) return;
    await repairOldProjectStems(id, await separatedStemRepair(stems, audio));
  } catch (error) {
    console.error(LOG_PREFIX, "could not correct the project's stems; they stay as saved", error);
  }
}

// Null leaves the flags as they are; a number is the shift to apply before both flags are set.
async function primingCorrectionShift(flags: PrimingFlags, audio: File | undefined): Promise<number | null> {
  if (!audio || (flags.primingStripped === true && flags.primingCorrected === true)) return null;
  if (flags.primingCorrected === true) return 0;
  const crop = await primingCropFor(audio);
  if (!crop) return null;
  return primingMigrationShift(flags, crop);
}

async function migratePrimingTimings(project: SavedProject, audio: File | undefined): Promise<boolean> {
  const flags = { primingStripped: project.primingStripped, primingCorrected: project.primingCorrected };
  const shift = await primingCorrectionShift(flags, audio);
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
  repairProjectStems,
  shiftAllTimings,
  shiftSavedTimings,
  shiftedSongTimings,
};
