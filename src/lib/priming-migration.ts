import { parseLamePriming } from "@/audio/lame-priming";
import { mainBounds } from "@/domain/line/bounds";
import { isLineSynced } from "@/domain/line/predicates";
import { reconcileLine, toFlat, type LyricLine } from "@/domain/line/model";
import { bgWords, mainWords } from "@/domain/line/voices";
import type { WordTiming } from "@/domain/word/timing";
import { loadAudioFile, loadCurrentProject, replaceCurrentProject, type SavedProject } from "@/lib/persistence";

// -- Helpers ------------------------------------------------------------------

function shiftWord(word: WordTiming, shiftSec: number): WordTiming {
  return {
    ...word,
    begin: Math.max(0, word.begin - shiftSec),
    end: Math.max(0, word.end - shiftSec),
  };
}

function shiftLine(line: LyricLine, shiftSec: number): LyricLine {
  const flat = toFlat(line);
  const words = mainWords(line);
  if (words) flat.words = words.map((w) => shiftWord(w, shiftSec));
  if (isLineSynced(line)) {
    const mb = mainBounds(line);
    if (mb) {
      flat.begin = Math.max(0, mb.begin - shiftSec);
      flat.end = Math.max(0, mb.end - shiftSec);
    }
  }
  const lineBgWords = bgWords(line);
  if (lineBgWords) flat.backgroundWords = lineBgWords.map((w) => shiftWord(w, shiftSec));
  return reconcileLine(flat);
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
  const { samples, sampleRate } = parseLamePriming(buf);
  if (samples > 0 && sampleRate > 0) {
    const shiftSec = samples / sampleRate;
    project.lines = shiftAllTimings(project.lines ?? [], shiftSec);
  }
  project.primingStripped = true;
  await replaceCurrentProject(project);
  return project;
}

// -- Exports ------------------------------------------------------------------

export { shiftAllTimings, loadCurrentProjectWithPrimingMigration };
