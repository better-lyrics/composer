import { applyBackground, type BackgroundSource, withSeededBackground } from "@/domain/line/background";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { lastEnd } from "@/domain/word/bounds";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import type { WordTiming } from "@/domain/word/timing";
import { bracketWordList, joinBackgroundText, joinBracketedCarriedWords } from "@/utils/background-vocal-brackets";
import { getSplitCharacter } from "@/utils/split-character";
import { createInitialBgWords } from "@/utils/sync-helpers";

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
): WordTiming[] | null {
  const words = standalone.words;
  let carry: WordTiming[] | null;
  if (words && words.length > 0) {
    carry = remapWordTextsPreservingTiming(words, bgText);
  } else if (isLineSynced(standalone)) {
    carry = createInitialBgWords(bgText, standalone.begin, standalone.end);
  } else if (untimedSpan) {
    carry = createInitialBgWords(bgText, untimedSpan.begin, untimedSpan.end);
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

function mergeStandaloneInto(
  prev: LyricLine,
  standalone: LyricLine,
  bgText: string,
  prevTrailingBracketFromSamePass: boolean,
  preserveBrackets: boolean,
): LyricLine | null {
  // On re-paste, prev's extraction-sourced background is stale output from a
  // prior pass, so the standalone line replaces it. Manual background is kept.
  // Extraction-sourced background produced earlier in this same pass (an
  // already-merged standalone) is fresh, so further standalones append to it.
  const prevIsExtraction = prev.backgroundTextSource === "extraction";
  const prevIsStaleExtraction = prevIsExtraction && !prevTrailingBracketFromSamePass;
  const baseText = prevIsStaleExtraction ? undefined : prev.backgroundText;
  const storedBaseWords = prevIsStaleExtraction ? undefined : prev.backgroundWords;
  const carried = carriedBackgroundWords(
    standalone,
    bgText,
    preserveBrackets,
    prevTrailingBracketFromSamePass && storedBaseWords?.length ? spanAfter(prev, storedBaseWords) : null,
  );
  const baseWords =
    carried?.length && !prevIsStaleExtraction ? withSeededBackground(prev).backgroundWords : storedBaseWords;

  // Source for a result that keeps the prev base: a surviving extraction base
  // is necessarily fresh same-pass output (stale extraction was dropped above),
  // so it stays extraction; manual or legacy-undefined stays manual.
  const keptBaseSource: BackgroundSource = prevIsExtraction ? "extraction" : "manual";

  if (carried && carried.length > 0) {
    if (baseWords && baseWords.length > 0) {
      const canSeamStrip = preserveBrackets && prevTrailingBracketFromSamePass;
      const combined = joinBracketedCarriedWords(baseWords, carried, canSeamStrip);
      return applyBackground(prev, {
        words: combined,
        text: reconstructLineText(combined, getSplitCharacter()),
        source: keptBaseSource,
      });
    }
    if (!baseText) {
      return applyBackground(prev, {
        words: carried,
        text: reconstructLineText(carried, getSplitCharacter()),
        source: "extraction",
      });
    }
    return applyBackground(prev, {
      text: joinBackgroundText(baseText, bgText, preserveBrackets, prevTrailingBracketFromSamePass),
      source: keptBaseSource,
    });
  }

  if (baseWords && baseWords.length > 0) return null;
  return applyBackground(prev, {
    text: joinBackgroundText(baseText, bgText, preserveBrackets, prevTrailingBracketFromSamePass),
    source: baseText ? keptBaseSource : "extraction",
  });
}

// -- Exports ------------------------------------------------------------------

export { mergeStandaloneInto };
