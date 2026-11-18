// Chinese and Japanese lyrics are usually written without spaces, so the
// editor sees a whole line as one word. For alignment each character becomes
// its own timed part, which is how word-synced CJK lyrics are usually made.

import { hasLetterOrDigit } from "insync/letter-or-digit";

// -- Constants ----------------------------------------------------------------

const HAN = /[\p{Script=Han}々〆]/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
// Small kana, the long-vowel mark and the small tsu only extend the kana
// before them, so they're timed with it.
const EXTENDS_PREVIOUS = /[ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッー]/u;

// -- Functions ----------------------------------------------------------------

function isCjk(char: string): boolean {
  return HAN.test(char) || KANA.test(char);
}

function hasHan(text: string): boolean {
  return HAN.test(text);
}

function hasCjk(text: string): boolean {
  return [...text].some(isCjk);
}

function hasKana(text: string): boolean {
  return KANA.test(text);
}

/**
 * Splits one editor part into alignment parts: one per Chinese/Japanese
 * character (with any extending kana), while runs of other letters stay
 * together and punctuation stays with what it follows.
 */
function splitCjkPart(part: string): string[] {
  if (!hasCjk(part)) return [part];
  const pieces: string[] = [];
  let run = "";
  const flushRun = () => {
    if (run) pieces.push(run);
    run = "";
  };
  for (const char of part) {
    if (isCjk(char)) {
      if (EXTENDS_PREVIOUS.test(char) && !run && pieces.length > 0) {
        pieces[pieces.length - 1] += char;
        continue;
      }
      flushRun();
      pieces.push(char);
    } else if (hasLetterOrDigit(char)) {
      run += char;
    } else if (run) {
      run += char;
    } else if (pieces.length > 0) {
      pieces[pieces.length - 1] += char;
    } else {
      run += char;
    }
  }
  flushRun();
  return pieces;
}

// -- Exports ------------------------------------------------------------------

export { hasCjk, hasHan, hasKana, splitCjkPart };
