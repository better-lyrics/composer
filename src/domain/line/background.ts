import { mainBounds } from "@/domain/line/bounds";
import type { LineFields, LyricLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { resolveBgGranularity } from "@/domain/line/resolve-bg-granularity";
import { mainVoice } from "@/domain/line/voices";
import type { BackgroundSource, BackgroundVoice } from "@/domain/voice/model";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface BackgroundParams {
  text?: string;
  words?: WordTiming[];
  source: BackgroundSource;
}

type BackgroundFields = Pick<LineFields, "backgroundText" | "backgroundWords" | "backgroundTextSource">;

// -- Nested writes ------------------------------------------------------------

// Pure nested write of a line's background voice. A null voice drops the
// background key entirely (immutably); otherwise the voice is set verbatim.
// Never mutates the input line.
function setBackground(line: LyricLine, voice: BackgroundVoice | null): LyricLine {
  if (voice === null) {
    const { background: _background, ...rest } = line;
    return rest;
  }
  return { ...line, background: voice };
}

// Builds a BackgroundVoice from write params. Words win over text; empty or
// whitespace-only text with no words yields null so the background is cleared.
function buildBackgroundVoice(params: BackgroundParams): BackgroundVoice | null {
  const words = params.words && params.words.length > 0 ? params.words : undefined;
  const text = params.text && params.text.trim().length > 0 ? params.text : undefined;
  if (words) return { text: text ?? "", words, source: params.source };
  if (text) return { text, source: params.source };
  return null;
}

// -- Funnel -------------------------------------------------------------------

// The single chokepoint for writing a line's background voice. Builds the voice
// from params, resolves its granularity against the line's main voice (so an
// untimed bg text becomes line-synced over a line-synced main, distributed over
// a word-synced main, or stays untimed over an untimed main), then writes it
// nested and directly. This bypasses the flat round-trip, which cannot express
// a line-synced background (LooseLine has no backgroundBegin/backgroundEnd).
function applyBackground(line: LyricLine, params: BackgroundParams): LyricLine {
  const bg = buildBackgroundVoice(params);
  if (bg === null) return setBackground(line, null);
  const resolved = resolveBgGranularity(mainVoice(line), bg, { fallbackBounds: mainBounds(line) });
  return setBackground(line, resolved);
}

// Keeps backgroundText, backgroundWords, and the backgroundTextSource
// provenance flag coherent for the flat write paths (word-synced and untimed
// background edits that round-trip through reconcileLine): an empty write clears
// all three.
function backgroundFields(params: BackgroundParams): BackgroundFields {
  const text = params.text && params.text.trim().length > 0 ? params.text : undefined;
  const words = params.words && params.words.length > 0 ? params.words : undefined;
  if (!text && !words) {
    return { backgroundText: undefined, backgroundWords: undefined, backgroundTextSource: undefined };
  }
  return { backgroundText: text, backgroundWords: words, backgroundTextSource: params.source };
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

// -- Exports ------------------------------------------------------------------

export {
  applyBackground,
  backgroundFields,
  buildBackgroundVoice,
  CLEARED_BACKGROUND,
  manualBackgroundWordEdit,
  setBackground,
};

export type { BackgroundParams };
