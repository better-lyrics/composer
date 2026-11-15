import { type BackgroundSource, withBackground, withSeededBackgroundWords } from "./line-background";
import { effectiveBounds, mainBounds } from "./line-bounds";
import type { LyricLine } from "./line";
import { isLineSynced } from "./line-predicates";
import { backgroundText, syllablesText } from "./line-text";
import { spreadSpan } from "./line-span-to-words";
import { backgroundTrack, isSpanTimed, roleWords, timedSyllables } from "./line-track";
import { lastEnd } from "./word-bounds";
import { remapWordTextsPreservingTiming } from "./word-remap-text";
import type { WordTiming } from "./word-timing";
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
  const baseText = prevIsStaleExtraction ? undefined : backgroundText(prev, splitChar);
  // A line-synced background counts as the words it spans, as 3.x stored seeded words for it.
  const storedBaseWords = prevIsStaleExtraction ? undefined : backgroundWords(prev);
  const carried = carriedBackgroundWords(
    standalone,
    bgText,
    preserveBrackets,
    prevTrailingBracketFromSamePass && storedBaseWords?.length ? spanAfter(prev, storedBaseWords) : null,
    splitChar,
  );
  const baseWords =
    carried?.length && !prevIsStaleExtraction
      ? (roleWords(withSeededBackgroundWords(prev, splitChar), "bg") ?? storedBaseWords)
      : storedBaseWords;

  // Source for a result that keeps the prev base: a surviving extraction base
  // is necessarily fresh same-pass output (stale extraction was dropped above),
  // so it stays extraction; manual or legacy-undefined stays manual.
  const keptBaseSource: BackgroundSource = prevIsExtraction ? "extraction" : "manual";

  if (carried && carried.length > 0) {
    if (baseWords && baseWords.length > 0) {
      const canSeamStrip = preserveBrackets && prevTrailingBracketFromSamePass;
      const combined = joinBracketedCarriedWords(baseWords, carried, canSeamStrip);
      return withBackground(
        prev,
        {
          words: combined,
          text: syllablesText(combined, splitChar),
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
          text: syllablesText(carried, splitChar),
          source: "extraction",
        },
        splitChar,
      );
    }
    return withBackground(
      prev,
      {
        text: joinBackgroundText(baseText, bgText, preserveBrackets, prevTrailingBracketFromSamePass),
        source: keptBaseSource,
      },
      splitChar,
    );
  }

  if (baseWords && baseWords.length > 0) return null;
  return withBackground(
    prev,
    {
      text: joinBackgroundText(baseText, bgText, preserveBrackets, prevTrailingBracketFromSamePass),
      source: baseText ? keptBaseSource : "extraction",
    },
    splitChar,
  );
}

// -- Exports ------------------------------------------------------------------

export { mergeStandaloneInto };
