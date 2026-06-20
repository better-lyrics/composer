import { setBackground } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { reconcileUpdate } from "@/domain/line/reconcile-update";
import { bgText, lineText } from "@/domain/line/voices";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Constants -----------------------------------------------------------------

type PlacedVoice = "main" | "background";

// -- Functions ----------------------------------------------------------------

function placedBounds(text: string, atTime: number, defaultWordDuration: number): { begin: number; end: number } {
  const wordCount = splitIntoWordsWithMeta(text).parts.length;
  return { begin: atTime, end: atTime + Math.max(wordCount, 1) * defaultWordDuration };
}

// Places a voice as line-synced at atTime, spanning max(wordCount,1) default
// word durations. The MAIN arm routes through reconcileUpdate so an existing
// line-synced background survives the flat round-trip; the BACKGROUND arm writes
// the nested voice directly (the bg funnel params cannot carry begin/end), and
// is a no-op when there is no untimed bg text to place.
function placeVoice(line: LyricLine, voice: PlacedVoice, atTime: number, defaultWordDuration: number): LyricLine {
  if (voice === "main") {
    return reconcileUpdate(line, placedBounds(lineText(line), atTime, defaultWordDuration));
  }
  const text = bgText(line);
  if (text === undefined || text.length === 0) return line;
  const { begin, end } = placedBounds(text, atTime, defaultWordDuration);
  return setBackground(line, { text, begin, end, source: "manual" });
}

// -- Exports ------------------------------------------------------------------

export { placeVoice };
