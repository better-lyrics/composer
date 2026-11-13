import type { LineFields } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type MainWordFields = Pick<LineFields, "text"> & { words: WordTiming[] };

// -- Functions ----------------------------------------------------------------

// Spread-friendly partial for the main-word funnel: returns the reconciled
// `{ words, text }` pair so callers building Partial<LyricLine> updates can
// Object.assign without first constructing a full line.
function mainWordEditFields(words: WordTiming[]): MainWordFields {
  return { words, text: reconstructLineText(words, getSplitCharacter()) };
}

// -- Exports ------------------------------------------------------------------

export { mainWordEditFields };
