import { withKeptSyllablePieces } from "@/domain/language/pieces";
import { withManualBackgroundWords } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { withRoleWords } from "@/domain/line/track-writes";
import { roleWords, trackWords } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { type IdenticalMatchSource, findIdenticalWords } from "@/utils/identical-word-matcher";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";

// -- Types --------------------------------------------------------------------

interface SplitTarget {
  lineId: string;
  wordIndex: number;
  type: "word" | "bg";
  word: WordTiming;
}

// -- Helpers ------------------------------------------------------------------

function replaceWordsAt(track: WordTiming[], wordIndex: number, replacement: WordTiming[]): WordTiming[] {
  return [...track.slice(0, wordIndex), ...replacement, ...track.slice(wordIndex + 1)];
}

function applyTargetsToLine(line: LyricLine, targets: SplitTarget[], splitPoints: number[]): LyricLine {
  const originalMain = roleWords(line, "main");
  const originalBg = roleWords(line, "bg");
  let mainWords = originalMain;
  let bgWords = originalBg;

  // Single descending sort across all targets is safe: projecting onto each
  // track preserves descending order, so per-track splice indices don't drift.
  const sortedDescending = targets.toSorted((a, b) => b.wordIndex - a.wordIndex);
  for (const target of sortedDescending) {
    const replacement = splitWordIntoSyllables({
      word: target.word,
      splitPoints,
    });
    if (target.type === "word" && mainWords) {
      mainWords = replaceWordsAt(mainWords, target.wordIndex, replacement);
    } else if (target.type === "bg" && bgWords) {
      bgWords = replaceWordsAt(bgWords, target.wordIndex, replacement);
    }
  }

  const mainLanguages =
    mainWords && originalMain && mainWords !== originalMain
      ? { ...line, languages: withKeptSyllablePieces(line, "main", originalMain, mainWords) }
      : line;
  const languages =
    bgWords && originalBg && bgWords !== originalBg
      ? withKeptSyllablePieces(mainLanguages, "bg", originalBg, bgWords)
      : mainLanguages.languages;
  const withMain = mainWords && mainWords !== originalMain ? withRoleWords(line, "main", mainWords) : line;
  const withBackground = bgWords && bgWords !== originalBg ? withManualBackgroundWords(withMain, bgWords) : withMain;
  return languages !== line.languages ? { ...withBackground, languages } : withBackground;
}

function findSourceTarget(lines: LyricLine[], source: IdenticalMatchSource): SplitTarget | null {
  const sourceLine = lines.find((line) => line.id === source.lineId);
  if (!sourceLine) return null;
  const track = trackWords(sourceLine, source.type);
  const word = track?.[source.wordIndex];
  if (!word) return null;
  return { lineId: source.lineId, wordIndex: source.wordIndex, type: source.type, word };
}

function applySyllableSplitToLines(
  lines: LyricLine[],
  source: IdenticalMatchSource,
  splitPoints: number[],
  caseInsensitive: boolean,
): LyricLine[] {
  const sourceTarget = findSourceTarget(lines, source);
  if (!sourceTarget) return lines;

  const matches = findIdenticalWords(lines, source, {
    caseInsensitive,
    excludeSource: true,
    splitPoints,
  });

  const targetsByLine = new Map<string, SplitTarget[]>();
  const pushTarget = (target: SplitTarget) => {
    const existing = targetsByLine.get(target.lineId);
    if (existing) existing.push(target);
    else targetsByLine.set(target.lineId, [target]);
  };

  pushTarget(sourceTarget);
  for (const match of matches) {
    pushTarget({
      lineId: match.lineId,
      wordIndex: match.wordIndex,
      type: match.type,
      word: match.word,
    });
  }

  return lines.map((line) => {
    const targets = targetsByLine.get(line.id);
    if (!targets) return line;
    return applyTargetsToLine(line, targets, splitPoints);
  });
}

// -- Exports ------------------------------------------------------------------

export { applySyllableSplitToLines };
