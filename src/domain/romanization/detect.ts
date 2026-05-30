// -- Types --------------------------------------------------------------------

type Script = "latin" | "japanese" | "chinese" | "korean";

// -- Unicode Ranges -----------------------------------------------------------

const HIRAGANA = /[぀-ゟ]/;
const KATAKANA = /[゠-ヿ]/;
const HALFWIDTH_KATAKANA = /[･-ﾟ]/;
const HANGUL_SYLLABLES = /[가-힯]/;
const HANGUL_JAMO = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/;
const CJK_UNIFIED = /[㐀-䶿一-鿿豈-﫿]/;
const BOM = /^﻿/;

// -- Detection ----------------------------------------------------------------

function detectScript(text: string): Script {
  const clean = text.replace(BOM, "");
  if (HIRAGANA.test(clean) || KATAKANA.test(clean) || HALFWIDTH_KATAKANA.test(clean)) return "japanese";
  if (HANGUL_SYLLABLES.test(clean) || HANGUL_JAMO.test(clean)) return "korean";
  if (CJK_UNIFIED.test(clean)) return "chinese";
  return "latin";
}

function hasNonLatinScript(text: string): boolean {
  return detectScript(text) !== "latin";
}

// -- Exports ------------------------------------------------------------------

export { detectScript, hasNonLatinScript };
export type { Script };
