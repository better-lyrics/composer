import type { BackgroundVoice, Voice } from "@/domain/voice/model";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";
import { voiceBounds } from "@/domain/voice/bounds";
import type { Bounds } from "@/domain/word/bounds";
import { distributeWordsInLine } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

interface ResolveBgGranularityOptions {
  fallbackBounds: Bounds | null;
}

// -- Helpers ------------------------------------------------------------------

function secondHalf(b: Bounds): Bounds {
  return { begin: (b.begin + b.end) / 2, end: b.end };
}

function withSource(voice: Voice, source: BackgroundVoice["source"]): BackgroundVoice {
  return source === undefined ? voice : { ...voice, source };
}

function distributeOver(text: string, bounds: Bounds, source: BackgroundVoice["source"]): BackgroundVoice | null {
  const words = distributeWordsInLine(text, bounds.begin, bounds.end);
  if (words.length === 0) return null;
  return withSource({ text, words }, source);
}

// -- Resolver -----------------------------------------------------------------

function resolveBgGranularity(main: Voice, bg: BackgroundVoice, opts: ResolveBgGranularityOptions): BackgroundVoice {
  if (isWordSynced(bg)) return bg;

  const ownBounds = voiceBounds(bg);
  if (ownBounds !== null) {
    if (isWordSynced(main)) {
      return distributeOver(bg.text, ownBounds, bg.source) ?? bg;
    }
    return bg;
  }

  const fallback = opts.fallbackBounds;
  if (fallback === null) return bg;
  const half = secondHalf(fallback);

  if (isWordSynced(main)) {
    return distributeOver(bg.text, half, bg.source) ?? bg;
  }

  if (isLineSynced(main) && bg.text.trim().length > 0) {
    return withSource({ text: bg.text, begin: half.begin, end: half.end }, bg.source);
  }

  return bg;
}

// -- Exports ------------------------------------------------------------------

export { resolveBgGranularity };
