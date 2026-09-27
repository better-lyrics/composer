import { getLanguageDisplayLine } from "@/domain/language/display";
import { mainWordEditFields } from "@/domain/line/main-words";
import { effectiveLineBrand, type LyricLine, reconcileLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { trackWords } from "@/domain/line/tracks";
import type { WordTiming } from "@/domain/word/timing";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type TimingSource = "words" | "line" | "none";

type EffectiveLine = LyricLine & { readonly [effectiveLineBrand]: true; readonly timingSource: TimingSource };
type ReadableLine = LyricLine | EffectiveLine;

// -- Functions ----------------------------------------------------------------

function effectiveWords(line: LyricLine): WordTiming[] {
  if (line.words?.length) return line.words;
  if (isLineSynced(line)) {
    return [{ text: stripSplitCharacter(line.text), begin: line.begin, end: line.end }];
  }
  return [];
}

function withEffectiveWords(line: LyricLine): LyricLine {
  if (!isLineSynced(line)) return line;
  const { begin: _begin, end: _end, ...rest } = line;
  return { ...rest, words: effectiveWords(line) };
}

function effectiveTrackWords(line: LyricLine, type: "word" | "bg"): WordTiming[] | undefined {
  return type === "word" ? effectiveWords(line) : trackWords(line, type);
}

function timingSourceOf(line: LyricLine): TimingSource {
  if (line.words?.length) return "words";
  return isLineSynced(line) ? "line" : "none";
}

function brand(line: LyricLine, timingSource: TimingSource): EffectiveLine {
  return { ...line, [effectiveLineBrand]: true, timingSource };
}

function isEffectiveLine(line: ReadableLine): line is EffectiveLine {
  return effectiveLineBrand in line;
}

function getEffectiveLines(lines: readonly LyricLine[]): EffectiveLine[] {
  return lines.map((line) => {
    const effectiveLine = withEffectiveWords(line);
    const display = getLanguageDisplayLine(effectiveLine, "transliteration");
    const displayed = reconcileLine({
      ...effectiveLine,
      ...(display.words ? { words: display.words } : {}),
      ...(display.backgroundWords ? { backgroundWords: display.backgroundWords } : {}),
    });
    return brand(displayed, timingSourceOf(line));
  });
}

function isLineSyncedSource(line: ReadableLine): boolean {
  return isEffectiveLine(line) ? line.timingSource === "line" : isLineSynced(line);
}

function effectiveTimingWrite(line: ReadableLine, words: WordTiming[]): Partial<LyricLine> {
  if (isLineSyncedSource(line) && words.length === 1) return { begin: words[0].begin, end: words[0].end };
  return { words };
}

function effectiveMainWordEdit(
  line: ReadableLine,
  words: WordTiming[],
  options: { convertLineSynced: true },
): Partial<LyricLine>;
function effectiveMainWordEdit(line: ReadableLine, words: WordTiming[]): Partial<LyricLine> | null;
function effectiveMainWordEdit(
  line: ReadableLine,
  words: WordTiming[],
  options?: { convertLineSynced: true },
): Partial<LyricLine> | null {
  if (options?.convertLineSynced || !isLineSyncedSource(line)) return mainWordEditFields(words);
  return words.length === 1 ? { begin: words[0].begin, end: words[0].end } : null;
}

function effectiveWordTextEdit(line: ReadableLine, words: WordTiming[]): Partial<LyricLine> {
  return isLineSyncedSource(line) ? { text: mainWordEditFields(words).text } : { words };
}

// -- Exports ------------------------------------------------------------------

export {
  effectiveMainWordEdit,
  effectiveTimingWrite,
  effectiveTrackWords,
  effectiveWordTextEdit,
  effectiveWords,
  getEffectiveLines,
  isLineSyncedSource,
};

export type { ReadableLine };
