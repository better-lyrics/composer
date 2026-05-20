import { reconcileLine, type LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { findIdenticalWords, type IdenticalMatchSource } from "@/utils/identical-word-matcher";
import { distributeTiming } from "@/utils/syllable-utils";
import { splitSourceWord } from "@/utils/word-timing";
import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface SplitTarget {
  lineId: string;
  wordIndex: number;
  type: "word" | "bg";
  word: WordTiming;
  reuseGroupId: boolean;
}

// -- Helpers ------------------------------------------------------------------

function splitOneWord(word: WordTiming, splitPoints: number[], reuseGroupId: boolean): WordTiming[] {
  const trimmed = word.text.trimEnd();
  const groupId = reuseGroupId && word.syllableGroupId !== undefined ? word.syllableGroupId : nanoid(8);
  const sourceForSplit: WordTiming = { ...word, syllableGroupId: groupId };
  const partitions = distributeTiming(trimmed, splitPoints, word.begin, word.end);
  const newWords = splitSourceWord(sourceForSplit, partitions);
  if (word.text.endsWith(" ") && newWords.length > 0) {
    const last = newWords[newWords.length - 1];
    newWords[newWords.length - 1] = { ...last, text: `${last.text} ` };
  }
  return newWords;
}

function replaceWordsAt(track: WordTiming[], wordIndex: number, replacement: WordTiming[]): WordTiming[] {
  return [...track.slice(0, wordIndex), ...replacement, ...track.slice(wordIndex + 1)];
}

function applyTargetsToLine(line: LyricLine, targets: SplitTarget[], splitPoints: number[]): LyricLine {
  let mainTrack = line.words;
  let bgTrack = line.backgroundWords;

  const sortedDescending = targets.toSorted((a, b) => b.wordIndex - a.wordIndex);
  for (const target of sortedDescending) {
    const replacement = splitOneWord(target.word, splitPoints, target.reuseGroupId);
    if (target.type === "word" && mainTrack) {
      mainTrack = replaceWordsAt(mainTrack, target.wordIndex, replacement);
    } else if (target.type === "bg" && bgTrack) {
      bgTrack = replaceWordsAt(bgTrack, target.wordIndex, replacement);
    }
  }

  return reconcileLine({
    ...line,
    ...(mainTrack !== line.words ? { words: mainTrack } : {}),
    ...(bgTrack !== line.backgroundWords ? { backgroundWords: bgTrack } : {}),
  });
}

function findSourceTarget(lines: LyricLine[], source: IdenticalMatchSource): SplitTarget | null {
  const sourceLine = lines.find((line) => line.id === source.lineId);
  if (!sourceLine) return null;
  const track = source.type === "word" ? sourceLine.words : sourceLine.backgroundWords;
  const word = track?.[source.wordIndex];
  if (!word) return null;
  return { lineId: source.lineId, wordIndex: source.wordIndex, type: source.type, word, reuseGroupId: true };
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
      reuseGroupId: false,
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
