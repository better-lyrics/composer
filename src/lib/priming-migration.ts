import { decodeCropChanged } from "@/audio/decoded-source-audio";
import { parseLamePriming } from "@/audio/lame-priming";
import type { LyricLine } from "@/domain/line/model";
import { shiftWords } from "@/domain/line/shift";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { shiftedSnapPoints } from "@/domain/snap-point/model";
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

interface PrimingFlags {
  primingStripped?: boolean;
  primingCorrected?: boolean;
}

// Corrected implies stripped: a new project can be saved before the audio engine sets primingStripped.
function primingMigrationShift(flags: PrimingFlags, primingSeconds: number, decoderTrims: boolean): number {
  if (flags.primingCorrected === true) return 0;
  const stripShift = flags.primingStripped === true ? 0 : -primingSeconds;
  return stripShift + (decoderTrims ? primingSeconds : 0);
}

function shiftSavedTimings(project: SavedProject, deltaSec: number): void {
  if (deltaSec === 0) return;
  project.lines = shiftAllTimings(project.lines ?? [], deltaSec);
  if (project.customSnapPoints) project.customSnapPoints = shiftedSnapPoints(project.customSnapPoints, deltaSec);
  const grid = readBeatGrid(project.beatGrid);
  if (grid) project.beatGrid = shiftedGrid(grid, deltaSec);
}

async function decoderTrims(audio: File): Promise<boolean | null> {
  try {
    return await decodeCropChanged(audio);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not decode the project audio; its timings stay as saved", error);
    return null;
  }
}

// Stems left uncorrected only sound early; the project must still open and its times must still move once.
async function correctProjectStems(id: string, primingSeconds: number): Promise<void> {
  try {
    await dropSeparatedProjectStems(id);
    await padImportedMp3Stems(id, primingSeconds);
  } catch (error) {
    console.error(LOG_PREFIX, "could not correct the project's stems; they stay as saved", error);
  }
}

async function migratePrimingTimings(id: string, project: SavedProject, audio: File | undefined): Promise<boolean> {
  if (!audio || (project.primingStripped === true && project.primingCorrected === true)) return false;
  const { samples, sampleRate } = parseLamePriming(await audio.arrayBuffer());
  const primingSeconds = samples > 0 && sampleRate > 0 ? samples / sampleRate : 0;
  const trims = project.primingCorrected !== true && primingSeconds > 0 ? await decoderTrims(audio) : false;
  if (trims === null) return false;
  shiftSavedTimings(project, primingMigrationShift(project, primingSeconds, trims));
  if (trims) await correctProjectStems(id, primingSeconds);
  project.primingStripped = true;
  project.primingCorrected = true;
  return true;
}

// -- Exports ------------------------------------------------------------------

export { migratePrimingTimings, primingMigrationShift, shiftAllTimings, shiftSavedTimings };
