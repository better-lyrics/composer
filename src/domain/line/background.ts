import type { LineFields, LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type BackgroundSource = "extraction" | "manual";

interface BackgroundParams {
  text?: string;
  words?: WordTiming[];
  source: BackgroundSource;
}

type BackgroundFields = Pick<LineFields, "backgroundText" | "backgroundWords" | "backgroundTextSource">;

// -- Funnel -------------------------------------------------------------------

// The single chokepoint for writing a line's background-vocal fields. Keeps
// backgroundText, backgroundWords, and the backgroundTextSource provenance flag
// coherent so the flag can never drift: an empty write clears all three.
// Callers must pass coherent text and words (the extraction code derives text
// from words via reconstructLineText before calling here).
function backgroundFields(params: BackgroundParams): BackgroundFields {
  const text = params.text && params.text.trim().length > 0 ? params.text : undefined;
  const words = params.words && params.words.length > 0 ? params.words : undefined;
  if (!text && !words) {
    return { backgroundText: undefined, backgroundWords: undefined, backgroundTextSource: undefined };
  }
  return { backgroundText: text, backgroundWords: words, backgroundTextSource: params.source };
}

function applyBackground(line: LyricLine, params: BackgroundParams): LyricLine {
  return reconcileLine({ ...line, ...backgroundFields(params) });
}

// -- Exports ------------------------------------------------------------------

export { applyBackground, backgroundFields };
export type { BackgroundFields, BackgroundParams, BackgroundSource };
