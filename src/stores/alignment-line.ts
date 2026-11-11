import type { AlignmentSegment, Aligner, SegmentAlignment } from "@/audio/alignment/types";
import { type AnchorChain, type AnchorWord, anchorWindow, keepsAnchored, lastWord } from "@/domain/alignment/anchor";
import { hasCjk } from "@/domain/alignment/cjk";
import type { HanReading } from "@/domain/alignment/language";
import { sungTransliteration } from "@/domain/alignment/transliteration";
import {
  type AlignmentWindow,
  lineSearchWindow,
  refinedWindow,
  searchWindow,
  spanWindow,
} from "@/domain/alignment/window";
import { type WordInterval, retimeWords, sanitizeIntervals, timingsFromParts } from "@/domain/alignment/words";
import type { WordTiming } from "@/domain/word/timing";
import { type PlannedLine, guideTaps, hasTappedEnd, plainWindow, segmentIn } from "@/stores/alignment-plan";

// One planned line through the aligner, as hubertfa-posttrain's step 1
// validated it (STEP1.md): anchored on the previous line's last word when it
// qualifies; otherwise a CTC search for the line's phones narrows the window,
// and the model aligns that window afresh. A model that finds lines itself
// (results/trainv3/line_head) replaces both: it finds the line's span from
// well before the tap, and the line is aligned alone in that span.

// -- Types --------------------------------------------------------------------

interface LineContext {
  aligner: Aligner;
  pcm: { samples: Float32Array; sampleRate: number };
  hanReading: HanReading;
  signal: AbortSignal;
  /** Whether lines may be anchored. The anchor was only validated on English. */
  anchors: boolean;
}

interface AlignedLine {
  result: SegmentAlignment;
  /**
   * The line's new word timing. Null when it fell back and no tap ended it:
   * an even split needs an end, so the line stays as it was.
   */
  timings: WordTiming[] | null;
  /** What the next line may anchor on. */
  chain: AnchorChain | null;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[alignment]";

// -- Functions ----------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}

function canAnchor(plan: PlannedLine, word: AnchorWord | null | undefined): word is AnchorWord {
  return !!word && !hasCjk(plan.line.text) && !hasCjk(word.parts.join("")) && sungTransliteration(plan.line) === null;
}

function finish(plan: PlannedLine, result: SegmentAlignment, window: AlignmentWindow, cooling: boolean): AlignedLine {
  const intervals = sanitizeIntervals(result.intervals, window);
  // A line no tap ended was aligned without one; nothing anchors on it.
  const continues = !result.fellBack && hasTappedEnd(plan);
  const { words, existing } = plan;
  const timings = existing ? retimeWords(existing, intervals) : timingsFromParts(words, intervals, result.splits);
  return {
    result,
    timings: !result.fellBack || hasTappedEnd(plan) ? timings : null,
    chain: continues ? { lineId: plan.line.id, word: lastWord(words, intervals), cooling } : null,
  };
}

// The anchored alignment, or null when it's rejected or fails.
async function alignAnchored(
  segment: AlignmentSegment,
  anchor: AnchorWord,
  ctx: LineContext,
): Promise<SegmentAlignment | null> {
  try {
    const result = await ctx.aligner.align(segment, ctx.signal);
    const first = result.intervals[0];
    if (!result.fellBack && result.anchor && first && keepsAnchored(anchor, result.anchor, first.begin, segment.taps)) {
      return result;
    }
  } catch (err) {
    if (isAbortError(err) || ctx.signal.aborted) throw err;
    console.warn(`${LOG_PREFIX} anchored alignment failed; aligning the line on its own`, err);
  }
  return null;
}

async function locate(segment: AlignmentSegment, ctx: LineContext): Promise<WordInterval | null> {
  try {
    return await ctx.aligner.locate(segment, ctx.signal);
  } catch (err) {
    if (isAbortError(err) || ctx.signal.aborted) throw err;
    console.warn(`${LOG_PREFIX} couldn't search for the line; aligning its plain window`, err);
    return null;
  }
}

/** Aligns one planned line. `chain` is what the line before it left, when this run aligned it. */
async function alignLine(plan: PlannedLine, ctx: LineContext, chain: AnchorChain | null): Promise<AlignedLine> {
  const { pcm, hanReading } = ctx;
  const duration = pcm.samples.length / pcm.sampleRate;
  const taps = guideTaps(plan, duration);
  const plain = plainWindow(plan, duration);
  if (ctx.aligner.findsLines()) {
    const search = lineSearchWindow(taps, duration);
    const span = await locate(segmentIn(plan, hanReading, pcm, search), ctx);
    const window = spanWindow(plain, search, span);
    const result = await ctx.aligner.align(segmentIn(plan, hanReading, pcm, window), ctx.signal);
    return finish(plan, result, window, false);
  }
  let cooling = false;
  const anchor = chain?.word;
  if (ctx.anchors && canAnchor(plan, anchor)) {
    const window = anchorWindow(chain, plan.previousId, taps, plain);
    const result = window && (await alignAnchored(segmentIn(plan, hanReading, pcm, window, anchor.parts), anchor, ctx));
    if (window && result) return finish(plan, result, window, false);
    // A rejected anchor skips the next line's, then the chain starts again.
    cooling = window !== null;
  }
  const search = searchWindow(taps, duration);
  const found = await locate(segmentIn(plan, hanReading, pcm, search), ctx);
  const window = refinedWindow(taps, plain, search, found);
  const result = await ctx.aligner.align(segmentIn(plan, hanReading, pcm, window), ctx.signal);
  return finish(plan, result, window, cooling);
}

// -- Exports ------------------------------------------------------------------

export { alignLine, isAbortError };
