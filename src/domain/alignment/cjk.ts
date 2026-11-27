// Chinese and Japanese lyrics are usually written without spaces, so the
// editor sees a whole line as one word. For alignment each character becomes
// its own timed part, which is how word-synced CJK lyrics are usually made.
// Korean is spaced, but its syllable blocks are timed the same way.

// -- Constants ----------------------------------------------------------------

const HAN = /[\p{Script=Han}々〆]/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
// Small kana, the long-vowel mark and the small tsu only extend the kana
// before them, so they're timed with it.
const EXTENDS_PREVIOUS = /[ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッー]/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const FIRST_HANGUL_BLOCK = 0xac00;
const LAST_HANGUL_BLOCK = 0xd7a3;

// -- Functions ----------------------------------------------------------------

function isCjk(char: string): boolean {
  return HAN.test(char) || KANA.test(char);
}

/** A precomposed Hangul syllable block (가 to 힣). */
function isHangulBlock(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= FIRST_HANGUL_BLOCK && code <= LAST_HANGUL_BLOCK;
}

// A character timed as its own part.
const isTimedAlone = (char: string) => isCjk(char) || isHangulBlock(char);

function hasHan(text: string): boolean {
  return HAN.test(text);
}

function hasLetterOrDigit(text: string): boolean {
  return LETTER_OR_DIGIT.test(text);
}

function hasCjk(text: string): boolean {
  return [...text].some(isCjk);
}

function hasKana(text: string): boolean {
  return KANA.test(text);
}

/**
 * Splits one editor part into alignment parts: one per Chinese/Japanese
 * character (with any extending kana) or Hangul block, while runs of other
 * letters stay together and punctuation stays with what it follows.
 */
function splitCjkPart(part: string): string[] {
  if (![...part].some(isTimedAlone)) return [part];
  const pieces: string[] = [];
  let run = "";
  const flushRun = () => {
    if (run) pieces.push(run);
    run = "";
  };
  for (const char of part) {
    if (isTimedAlone(char)) {
      if (EXTENDS_PREVIOUS.test(char) && !run && pieces.length > 0) {
        pieces[pieces.length - 1] += char;
        continue;
      }
      flushRun();
      pieces.push(char);
    } else if (LETTER_OR_DIGIT.test(char)) {
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

export { hasCjk, hasHan, hasKana, hasLetterOrDigit, isHangulBlock, splitCjkPart };
