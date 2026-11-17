import {
  type BackgroundSource,
  withBackground,
  withSeededBackground,
  withSeededBackgroundWords,
} from "./line-background";
import { bgBounds, effectiveBounds, mainBounds } from "./line-bounds";
import type { LyricLine } from "./line";
import { isLineSynced, isWordSynced } from "./line-predicates";
import { backgroundText, syllablesText } from "./line-text";
import { spreadSpan } from "./line-span-to-words";
import { backgroundTrack, isSpanTimed, isTimedSyllable, roleWords, timedSyllables } from "./line-track";
import { withBackgroundTrack, withTrackSpan } from "./line-track-writes";
import { type Bounds, lastEnd } from "./word-bounds";
import { remapWordTextsWithinLimit } from "./word-remap-text";
import type { WordTiming } from "./word-timing";
import {
  type BracketJoin,
  bracketWordList,
  joinBackgroundText,
  joinBracketedCarriedWords,
  joinExtractedParts,
  withOpenPair,
  backgroundParts,
} from "./background-vocal-brackets";
import { createInitialBgWords } from "./lyric-words";

// -- Types --------------------------------------------------------------------

interface TimeSpan {
  begin: number;
  end?: number;
}

// -- Standalone merge ---------------------------------------------------------

// What a merged row adds: its bracketed text, then its own background as one more part.
function rowParts(bgText: string, ownText: string, join: BracketJoin): string {
  return joinExtractedParts([bgText, ...backgroundParts(ownText)], join.separator);
}

function carriedBackgroundWords(
  standalone: LyricLine,
  bgText: string,
  preserveBrackets: boolean,
  untimedSpan: TimeSpan | null,
  splitChar: string,
  songEnd: number,
): WordTiming[] | null {
  const words = roleWords(standalone, "main");
  let carry: WordTiming[] | null;
  if (words && words.length > 0) {
    const remapped = remapWordTextsWithinLimit(words, bgText, splitChar, songEnd);
    carry = remapped.untimedFrom === remapped.words.length ? remapped.words : null;
  } else if (isLineSynced(standalone)) {
    const span = mainBounds(standalone);
    carry = span && createInitialBgWords(bgText, span.begin, span.end, splitChar);
  } else if (untimedSpan) {
    carry = createInitialBgWords(bgText, untimedSpan.begin, untimedSpan.end, splitChar);
  } else {
    carry = null;
  }
  if (!preserveBrackets) return carry;
  if (!carry || carry.length === 0) return carry;
  return bracketWordList(carry);
}

function spanAfter(line: LyricLine, words: WordTiming[]): TimeSpan {
  const begin = lastEnd(words);
  const end = effectiveBounds(line)?.end;
  return { begin, end: end !== undefined && end > begin ? end : undefined };
}

function backgroundWords(line: LyricLine): WordTiming[] | undefined {
  const background = backgroundTrack(line);
  if (!background || !isSpanTimed(background)) return roleWords(line, "bg");
  return timedSyllables(spreadSpan(line.id, background));
}

function ownBackground(standalone: LyricLine, splitChar: string): { text: string; words: WordTiming[]; rest: string } {
  const background = backgroundTrack(standalone);
  if (!background) return { text: "", words: [], rest: "" };
  const words = backgroundWords(standalone) ?? [];
  const rest = isSpanTimed(background) ? [] : background.syllables.filter((syllable) => !isTimedSyllable(syllable));
  return {
    text: backgroundText(standalone, splitChar)?.trim() ?? "",
    words,
    rest: syllablesText(rest, splitChar).trim(),
  };
}

function spanOver(first: Bounds | null, second: Bounds | null): Bounds | null {
  if (!first || !second) return first ?? second;
  return { begin: Math.min(first.begin, second.begin), end: Math.max(first.end, second.end) };
}

// A line-synced line takes the standalone row as one span-timed background, the same as the text written inline.
function mergeIntoLineSynced(
  base: LyricLine,
  standalone: LyricLine,
  bgText: string,
  keptBaseSource: BackgroundSource,
  join: BracketJoin,
  splitChar: string,
  songEnd: number,
): LyricLine {
  const baseText = backgroundText(base, splitChar);
  const merged = withBackground(
    base,
    {
      text: joinBackgroundText(baseText, rowParts(bgText, ownBackground(standalone, splitChar).text, join), join),
      source: baseText ? keptBaseSource : "extraction",
    },
    splitChar,
  );
  const span = spanOver(bgBounds(withSeededBackground(base, splitChar, songEnd)), effectiveBounds(standalone));
  const background = backgroundTrack(merged);
  return span && background ? withBackgroundTrack(merged, withTrackSpan(background, span.begin, span.end)) : merged;
}

function mergeStandaloneInto(
  prev: LyricLine,
  standalone: LyricLine,
  bgText: string,
  prevTrailingBracketFromSamePass: boolean,
  join: BracketJoin,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine | null {
  // An extracted background, or one this pass wrote, takes the row's timing after its own.
  const prevIsExtraction = backgroundTrack(prev)?.source === "extraction";
  const freshBackground = prevIsExtraction || prevTrailingBracketFromSamePass;
  const keptBaseSource: BackgroundSource = prevIsExtraction ? "extraction" : "manual";
  // A background timed by hand before this pass, a background with word timing, or a row with its own word timing
  // keeps that timing, so the row merges word by word below.
  const keepsWordTiming = isWordSynced(standalone) || timedSyllables(backgroundTrack(prev)).length > 0;
  if (isLineSynced(prev) && !keepsWordTiming && (freshBackground || !bgBounds(prev))) {
    return mergeIntoLineSynced(prev, standalone, bgText, keptBaseSource, join, splitChar, songEnd);
  }
  const baseText = backgroundText(prev, splitChar);
  // A line-synced background counts as the words it spans, as 3.x stored seeded words for it.
  const storedBaseWords = backgroundWords(prev);
  const sung = carriedBackgroundWords(
    standalone,
    bgText,
    join.preserveBrackets,
    freshBackground && storedBaseWords?.length ? spanAfter(prev, storedBaseWords) : null,
    splitChar,
    songEnd,
  );
  const own = ownBackground(standalone, splitChar);
  const text = joinBackgroundText(baseText, rowParts(bgText, own.text, join), join);
  const carried = sung?.length && own.words.length ? joinBracketedCarriedWords(sung, own.words, join) : sung;
  // The row's own untimed rest follows its timed words in the text, so the pair closes after it.
  const opened = (words: WordTiming[]) => (own.rest ? withOpenPair(words, join, own.words.length === 0) : words);
  const baseWords = carried?.length
    ? (roleWords(withSeededBackgroundWords(prev, splitChar), "bg") ?? storedBaseWords)
    : storedBaseWords;

  // Untimed words already after the base's timed ones stay before the row, so the row joins that untimed rest.
  const baseRest = ownBackground(prev, splitChar).rest;
  if (carried && carried.length > 0) {
    if (baseWords && baseWords.length > 0 && baseRest) {
      return withBackground(prev, { words: baseWords, text, source: keptBaseSource }, splitChar);
    }
    if (baseWords && baseWords.length > 0) {
      const combined = opened(joinBracketedCarriedWords(baseWords, carried, join));
      return withBackground(prev, { words: combined, text, source: keptBaseSource }, splitChar);
    }
    if (!baseText) {
      return withBackground(prev, { words: opened(carried), text, source: "extraction" }, splitChar);
    }
    return withBackground(prev, { text, source: keptBaseSource }, splitChar);
  }

  if (baseWords && baseWords.length > 0) return null;
  return withBackground(prev, { text, source: baseText ? keptBaseSource : "extraction" }, splitChar);
}

// -- Exports ------------------------------------------------------------------

export { mergeStandaloneInto };
