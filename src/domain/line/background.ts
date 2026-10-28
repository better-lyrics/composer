import { effectiveBounds } from "@/domain/line/bounds";
import type { LineFields, LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";
import { createInitialBgWords } from "@/utils/sync-helpers";

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

// The coherent all-undefined triple, for clear sites where there is no
// meaningful source to stamp.
const CLEARED_BACKGROUND: BackgroundFields = {
  backgroundText: undefined,
  backgroundWords: undefined,
  backgroundTextSource: undefined,
};

// Any timeline edit of a line's background words (retime, split, merge, add,
// delete, drag) is manual curation: a re-paste or re-extraction must not
// silently overwrite it. This stamps source "manual" and keeps backgroundText
// coherent with the edited word array.
function manualBackgroundWordEdit(words: WordTiming[]): BackgroundFields {
  return backgroundFields({
    words,
    text: reconstructLineText(words, getSplitCharacter()),
    source: "manual",
  });
}

function withSeededBackground(line: LyricLine): LyricLine {
  if (!line.backgroundText || line.backgroundWords?.length) return line;
  const bounds = effectiveBounds(line);
  if (!bounds) return line;
  const words = createInitialBgWords(line.backgroundText, (bounds.begin + bounds.end) / 2, bounds.end);
  return words.length > 0 ? reconcileLine({ ...line, backgroundWords: words }) : line;
}

// -- Exports ------------------------------------------------------------------

export { applyBackground, backgroundFields, CLEARED_BACKGROUND, manualBackgroundWordEdit, withSeededBackground };
export type { BackgroundSource };
