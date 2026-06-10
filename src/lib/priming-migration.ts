import { parseLamePriming } from "@/audio/lame-priming";
import { TARGET_SAMPLE_RATE } from "@/audio/separation/audio-codec";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { loadAudioFile, loadCurrentProject, type SavedProject } from "@/lib/persistence";

// -- Helpers ------------------------------------------------------------------

function shiftWord(word: WordTiming, shiftSec: number): WordTiming {
  return {
    ...word,
    begin: Math.max(0, word.begin - shiftSec),
    end: Math.max(0, word.end - shiftSec),
  };
}

function shiftLine(line: LyricLine, shiftSec: number): LyricLine {
  const next = { ...line } as LyricLine;
  if ("words" in next && next.words) {
    (next as { words: WordTiming[] }).words = next.words.map((w) => shiftWord(w, shiftSec));
  }
  if ("begin" in next && next.begin !== undefined && "end" in next && next.end !== undefined) {
    (next as { begin: number; end: number }).begin = Math.max(0, next.begin - shiftSec);
    (next as { begin: number; end: number }).end = Math.max(0, next.end - shiftSec);
  }
  if (next.backgroundWords) {
    next.backgroundWords = next.backgroundWords.map((w) => shiftWord(w, shiftSec));
  }
  return next;
}

// -- Public API ---------------------------------------------------------------

function shiftAllTimings(lines: LyricLine[], shiftSec: number): LyricLine[] {
  if (shiftSec === 0) return lines;
  return lines.map((line) => shiftLine(line, shiftSec));
}

async function loadCurrentProjectWithPrimingMigration(): Promise<SavedProject | undefined> {
  const project = await loadCurrentProject();
  if (!project) return project;
  if (project.primingStripped === true) return project;
  const audioFile = await loadAudioFile();
  if (!audioFile) return project;
  const buf = await audioFile.arrayBuffer();
  const priming = parseLamePriming(buf);
  if (priming > 0) {
    const shiftSec = priming / TARGET_SAMPLE_RATE;
    project.lines = shiftAllTimings(project.lines ?? [], shiftSec);
  }
  project.primingStripped = true;
  return project;
}

// -- Exports ------------------------------------------------------------------

export { shiftAllTimings, loadCurrentProjectWithPrimingMigration };
