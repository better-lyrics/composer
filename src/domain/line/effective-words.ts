import { withAlignedTransliteration } from "@/domain/language/align";
import { mainWordEditFields } from "@/domain/line/main-words";
import { type LyricLine, effectiveLineBrand } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { syllablesText, trackText } from "@/domain/line/text";
import { isSpanTimed, mainTrack, timedSyllables, trackWords } from "@/domain/line/track";
import {
  withMainTrack,
  withRoleWords,
  withTrackSpan,
  withTrackSyllables,
  withTrackText,
} from "@/domain/line/track-writes";
import { lineTimingWordId } from "@/domain/word/id";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter, stripSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type TimingSource = "words" | "line" | "none";

type EffectiveLine = LyricLine & { readonly [effectiveLineBrand]: true; readonly timingSource: TimingSource };
type ReadableLine = LyricLine | EffectiveLine;

// -- Functions ----------------------------------------------------------------

function effectiveWords(line: LyricLine): WordTiming[] {
  const main = mainTrack(line);
  if (!isSpanTimed(main)) return timedSyllables(main);
  const text = stripSplitCharacter(trackText(main));
  return [wordFromSpaced({ id: lineTimingWordId(line.id), text, begin: main.begin, end: main.end })];
}

function withEffectiveWords(line: LyricLine): LyricLine {
  if (!isLineSynced(line)) return line;
  const { begin: _begin, end: _end, ...main } = mainTrack(line);
  return withMainTrack(line, { ...main, syllables: effectiveWords(line) });
}

function effectiveTrackWords(line: LyricLine, type: "word" | "bg"): WordTiming[] | undefined {
  return type === "word" ? effectiveWords(line) : trackWords(line, type);
}

function timingSourceOf(line: LyricLine): TimingSource {
  if (timedSyllables(mainTrack(line)).length > 0) return "words";
  return isLineSynced(line) ? "line" : "none";
}

const rawLineOfEffective = new WeakMap<EffectiveLine, LyricLine>();

function brand(line: LyricLine, raw: LyricLine, timingSource: TimingSource): EffectiveLine {
  const effective: EffectiveLine = { ...line, [effectiveLineBrand]: true, timingSource };
  rawLineOfEffective.set(effective, raw);
  return effective;
}

function isEffectiveLine(line: ReadableLine): line is EffectiveLine {
  return effectiveLineBrand in line;
}

// Writes land on the stored line, never on the drawn one.
function rawLineOf(line: ReadableLine): LyricLine {
  return (isEffectiveLine(line) && rawLineOfEffective.get(line)) || line;
}

function computeEffectiveLine(line: LyricLine): EffectiveLine {
  return brand(withAlignedTransliteration(withEffectiveWords(line)), line, timingSourceOf(line));
}

interface CachedEffectiveLine {
  splitCharacter: string;
  effectiveLine: EffectiveLine;
}

const effectiveLineCache = new WeakMap<LyricLine, CachedEffectiveLine>();

function cachedEffectiveLine(line: LyricLine, splitCharacter: string): EffectiveLine {
  const cached = effectiveLineCache.get(line);
  if (cached?.splitCharacter === splitCharacter) return cached.effectiveLine;
  const effectiveLine = computeEffectiveLine(line);
  effectiveLineCache.set(line, { splitCharacter, effectiveLine });
  return effectiveLine;
}

function getEffectiveLine(line: LyricLine): EffectiveLine {
  return cachedEffectiveLine(line, getSplitCharacter());
}

function getEffectiveLines(lines: readonly LyricLine[]): EffectiveLine[] {
  const splitCharacter = getSplitCharacter();
  return lines.map((line) => cachedEffectiveLine(line, splitCharacter));
}

function isLineSyncedSource(line: ReadableLine): boolean {
  return isEffectiveLine(line) ? line.timingSource === "line" : isLineSynced(line);
}

function spanWrite(line: ReadableLine, word: WordTiming): Partial<LyricLine> {
  const raw = rawLineOf(line);
  return { tracks: withMainTrack(raw, withTrackSpan(mainTrack(raw), word.begin, word.end)).tracks };
}

function effectiveTimingWrite(line: ReadableLine, words: WordTiming[]): Partial<LyricLine> {
  if (isLineSyncedSource(line) && words.length === 1) return spanWrite(line, words[0]);
  return { tracks: withRoleWords(rawLineOf(line), "main", words).tracks };
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
  // Converting a line-synced line writes the words over its whole track: its one drawn word stands for all of it.
  if (options?.convertLineSynced && isLineSyncedSource(line)) {
    const raw = rawLineOf(line);
    return { tracks: withMainTrack(raw, withTrackSyllables(mainTrack(raw), words)).tracks };
  }
  if (!isLineSyncedSource(line)) return mainWordEditFields(rawLineOf(line), words);
  return words.length === 1 ? spanWrite(line, words[0]) : null;
}

function effectiveWordTextEdit(line: ReadableLine, words: WordTiming[]): Partial<LyricLine> {
  const raw = rawLineOf(line);
  if (!isLineSyncedSource(line)) return { tracks: withRoleWords(raw, "main", words).tracks };
  return {
    tracks: withMainTrack(raw, withTrackText(mainTrack(raw), syllablesText(words, getSplitCharacter()))).tracks,
  };
}

// -- Exports ------------------------------------------------------------------

export {
  effectiveMainWordEdit,
  effectiveTimingWrite,
  effectiveTrackWords,
  effectiveWordTextEdit,
  effectiveWords,
  getEffectiveLine,
  getEffectiveLines,
  isLineSyncedSource,
  rawLineOf,
};

export type { EffectiveLine, ReadableLine };
