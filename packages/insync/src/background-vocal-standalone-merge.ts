import {
  type BackgroundSource,
  withBackground,
  withoutBackground,
  withSeededBackground,
  withSeededBackgroundWords,
} from "./line-background";
import { bgBounds, effectiveBounds, mainBounds } from "./line-bounds";
import type { LyricLine } from "./line";
import { isLineSynced } from "./line-predicates";
import { backgroundText, syllablesText } from "./line-text";
import { spreadSpan } from "./line-span-to-words";
import { backgroundTrack, isSpanTimed, isTimedSyllable, roleWords, timedSyllables } from "./line-track";
import { withBackgroundTrack, withTrackSpan } from "./line-track-writes";
import { type Bounds, lastEnd } from "./word-bounds";
import { remapWordTextsPreservingTiming } from "./word-remap-text";
import type { WordTiming } from "./word-timing";
import { withTrailingSpace } from "./word-spaces";
import { bracketWordList, joinBackgroundText, joinBracketedCarriedWords } from "./background-vocal-brackets";
import { createInitialBgWords } from "./lyric-words";

// -- Types --------------------------------------------------------------------

interface TimeSpan {
  begin: number;
  end?: number;
}

// -- Standalone merge ---------------------------------------------------------

function carriedBackgroundWords(
  standalone: LyricLine,
  bgText: string,
  preserveBrackets: boolean,
  untimedSpan: TimeSpan | null,
  splitChar: string,
): WordTiming[] | null {
  const words = roleWords(standalone, "main");
  let carry: WordTiming[] | null;
  if (words && words.length > 0) {
    carry = remapWordTextsPreservingTiming(words, bgText, splitChar);
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
  prev: LyricLine,
  standalone: LyricLine,
  bgText: string,
  sameSession: boolean,
  keptBaseSource: BackgroundSource,
  preserveBrackets: boolean,
  splitChar: string,
): LyricLine | null {
  const base = backgroundTrack(prev)?.source === "extraction" && !sameSession ? withoutBackground(prev) : prev;
  if (!sameSession && bgBounds(base)) return null;
  const baseText = backgroundText(base, splitChar);
  const ownText = backgroundText(standalone, splitChar)?.trim();
  const merged = withBackground(
    base,
    {
      text: joinBackgroundText(baseText, ownText ? `${bgText} ${ownText}` : bgText, preserveBrackets, sameSession),
      source: baseText ? keptBaseSource : "extraction",
    },
    splitChar,
  );
  const span = spanOver(bgBounds(withSeededBackground(base, splitChar)), effectiveBounds(standalone));
  const background = backgroundTrack(merged);
  return span && background ? withBackgroundTrack(merged, withTrackSpan(background, span.begin, span.end)) : merged;
}

function mergeStandaloneInto(
  prev: LyricLine,
  standalone: LyricLine,
  bgText: string,
  prevTrailingBracketFromSamePass: boolean,
  preserveBrackets: boolean,
  splitChar: string,
): LyricLine | null {
  // On re-paste, prev's extraction-sourced background is stale output from a
  // prior pass, so the standalone line replaces it. Manual background is kept.
  // Extraction-sourced background produced earlier in this same pass (an
  // already-merged standalone) is fresh, so further standalones append to it.
  const prevIsExtraction = backgroundTrack(prev)?.source === "extraction";
  const prevIsStaleExtraction = prevIsExtraction && !prevTrailingBracketFromSamePass;
  // Source for a result that keeps the prev base: a surviving extraction base
  // is necessarily fresh same-pass output (stale extraction was dropped above),
  // so it stays extraction; manual or legacy-undefined stays manual.
  const keptBaseSource: BackgroundSource = prevIsExtraction ? "extraction" : "manual";
  if (isLineSynced(prev)) {
    return mergeIntoLineSynced(
      prev,
      standalone,
      bgText,
      prevTrailingBracketFromSamePass,
      keptBaseSource,
      preserveBrackets,
      splitChar,
    );
  }
  const baseText = prevIsStaleExtraction ? undefined : backgroundText(prev, splitChar);
  // A line-synced background counts as the words it spans, as 3.x stored seeded words for it.
  const storedBaseWords = prevIsStaleExtraction ? undefined : backgroundWords(prev);
  const sung = carriedBackgroundWords(
    standalone,
    bgText,
    preserveBrackets,
    prevTrailingBracketFromSamePass && storedBaseWords?.length ? spanAfter(prev, storedBaseWords) : null,
    splitChar,
  );
  // The standalone line's own background follows its lyrics: timed words after the carried ones, the rest as text.
  const own = ownBackground(standalone, splitChar);
  const carried = sung?.length && own.words.length ? [...withTrailingSpace(sung), ...own.words] : sung;
  const withOwnRest = (text: string) => (own.rest ? `${text.trimEnd()} ${own.rest}` : text);
  const sungText = own.text ? `${bgText} ${own.text}` : bgText;
  const baseWords =
    carried?.length && !prevIsStaleExtraction
      ? (roleWords(withSeededBackgroundWords(prev, splitChar), "bg") ?? storedBaseWords)
      : storedBaseWords;

  if (carried && carried.length > 0) {
    if (baseWords && baseWords.length > 0) {
      const canSeamStrip = preserveBrackets && prevTrailingBracketFromSamePass;
      const combined = joinBracketedCarriedWords(baseWords, carried, canSeamStrip);
      return withBackground(
        prev,
        {
          words: combined,
          text: withOwnRest(syllablesText(combined, splitChar)),
          source: keptBaseSource,
        },
        splitChar,
      );
    }
    if (!baseText) {
      return withBackground(
        prev,
        {
          words: carried,
          text: withOwnRest(syllablesText(carried, splitChar)),
          source: "extraction",
        },
        splitChar,
      );
    }
    return withBackground(
      prev,
      {
        text: joinBackgroundText(baseText, sungText, preserveBrackets, prevTrailingBracketFromSamePass),
        source: keptBaseSource,
      },
      splitChar,
    );
  }

  if (baseWords && baseWords.length > 0) return null;
  return withBackground(
    prev,
    {
      text: joinBackgroundText(baseText, sungText, preserveBrackets, prevTrailingBracketFromSamePass),
      source: baseText ? keptBaseSource : "extraction",
    },
    splitChar,
  );
}

// -- Exports ------------------------------------------------------------------

export { mergeStandaloneInto };
