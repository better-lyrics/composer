// -- Types --------------------------------------------------------------------

type Script =
  | "latin"
  | "japanese"
  | "chinese"
  | "korean"
  | "russian"
  | "greek"
  | "thai"
  | "arabic"
  | "hindi"
  | "bengali"
  | "hebrew";

// -- Unicode Ranges -----------------------------------------------------------

const HIRAGANA = /[぀-ゟ]/;
const KATAKANA = /[゠-ヿ]/;
const HALFWIDTH_KATAKANA = /[･-ﾟ]/;
const HANGUL_SYLLABLES = /[가-힯]/;
// Hangul Jamo (U+1100-U+11FF), Hangul Compatibility Jamo (U+3130-U+318F),
// Hangul Jamo Extended-A (U+A960-U+A97F), Hangul Jamo Extended-B (U+D7B0-U+D7FF).
const HANGUL_NON_SYLLABLE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/;
const CJK_UNIFIED = /[㐀-䶿一-鿿豈-﫿]/;
const CYRILLIC = /[Ѐ-ԯ]/;
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const THAI = /[฀-๿]/;
const ARABIC = /[؀-ۿݐ-ݿ]/;
const DEVANAGARI = /[ऀ-ॿ]/;
const BENGALI = /[ঀ-৿]/;
const HEBREW = /[֐-׿]/;
const BOM = /^﻿/;

// -- Detection ----------------------------------------------------------------

function detectScript(text: string): Script {
  const clean = text.replace(BOM, "");
  if (HIRAGANA.test(clean) || KATAKANA.test(clean) || HALFWIDTH_KATAKANA.test(clean)) return "japanese";
  if (HANGUL_SYLLABLES.test(clean) || HANGUL_NON_SYLLABLE.test(clean)) return "korean";
  if (CJK_UNIFIED.test(clean)) return "chinese";
  if (CYRILLIC.test(clean)) return "russian";
  if (GREEK.test(clean)) return "greek";
  if (THAI.test(clean)) return "thai";
  if (ARABIC.test(clean)) return "arabic";
  if (DEVANAGARI.test(clean)) return "hindi";
  if (BENGALI.test(clean)) return "bengali";
  if (HEBREW.test(clean)) return "hebrew";
  return "latin";
}

function hasNonLatinScript(text: string): boolean {
  return detectScript(text) !== "latin";
}

// -- Exports ------------------------------------------------------------------

export { detectScript, hasNonLatinScript };
export type { Script };
