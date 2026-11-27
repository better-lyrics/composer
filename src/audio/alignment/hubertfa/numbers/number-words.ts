import { AR_ONES, arabicNumber } from "@/audio/alignment/hubertfa/numbers/arabic";
import {
  JA_DIGITS,
  KO_DIGITS,
  ZH_DIGITS,
  japaneseNumber,
  koreanNative,
  koreanNumber,
  mandarinNumber,
} from "@/audio/alignment/hubertfa/numbers/east-asian";
import {
  ENGLISH_DIGITS,
  englishCardinal,
  englishOrdinal,
  englishPlural,
  englishYear,
} from "@/audio/alignment/hubertfa/numbers/english";
import {
  DE_SMALL,
  ID_SMALL,
  TR_SMALL,
  germanNumber,
  indonesianNumber,
  turkishNumber,
} from "@/audio/alignment/hubertfa/numbers/other-latin";
import {
  ES_SMALL,
  FR_SMALL,
  IT_SMALL,
  PT_SMALL,
  type Speller,
  frenchNumber,
  italianNumber,
  portugueseNumber,
  spanishNumber,
} from "@/audio/alignment/hubertfa/numbers/romance";
import type { LatinReader } from "@/domain/alignment/language";
import { isLetter } from "@/domain/language/script-detection";

// A written number ("17", "1,000", "24/7", "90s", "4ever") as the words sung
// for it in one language. Which reading a singer chose can't be known (a year
// or a count, "oh" or "zero"), so the result is a best guess and its word is
// reported as one.

// -- Types --------------------------------------------------------------------

type NumberLanguage = "en" | LatinReader | "ko" | "ar" | "ja" | "zh";

type Piece = { digits: string } | { letters: string };

// -- Constants ----------------------------------------------------------------

/** Each language's whole numbers under a million, and its digits for a number read out one by one. */
const SPELLERS: Readonly<Record<Exclude<NumberLanguage, "en">, { number: Speller; digits: readonly string[] }>> = {
  es: { number: spanishNumber, digits: ES_SMALL },
  pt: { number: portugueseNumber, digits: PT_SMALL },
  fr: { number: frenchNumber, digits: FR_SMALL },
  it: { number: italianNumber, digits: IT_SMALL },
  de: { number: germanNumber, digits: DE_SMALL },
  tr: { number: turkishNumber, digits: TR_SMALL },
  id: { number: indonesianNumber, digits: ID_SMALL },
  ko: { number: koreanNumber, digits: KO_DIGITS },
  ja: { number: japaneseNumber, digits: JA_DIGITS },
  zh: { number: mandarinNumber, digits: ZH_DIGITS },
  ar: { number: arabicNumber, digits: AR_ONES },
};
// A number in thousands groups ("1,000", "10.000"), a plain run of digits, or a run of letters.
const PIECE = /\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+|[\p{L}\p{M}']+/gu;
// Arabic-Indic and Persian digits, which NFKC leaves as they are.
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;
const ORDINAL_ENDING = /^(?:st|nd|rd|th)$/i;
const PLURAL_ENDING = /^'?s$/i;
const MAX_SPELLED_DIGITS = 6;

// -- Functions ----------------------------------------------------------------

function westernDigits(text: string): string {
  return text.normalize("NFKC").replace(EASTERN_DIGITS, (digit) => String((digit.codePointAt(0) ?? 0) & 0xf));
}

function pieces(text: string): Piece[] {
  return (westernDigits(text).match(PIECE) ?? []).flatMap((piece): Piece[] => {
    // A piece that starts with a digit is a number; any other is letters, or a stray apostrophe.
    if (piece[0] >= "0" && piece[0] <= "9") return [{ digits: piece.replace(/[.,]/g, "") }];
    return [...piece].some(isLetter) ? [{ letters: piece }] : [];
  });
}

// A leading zero ("007") or a very long run (a phone number) is read out digit by digit.
const readOut = (digits: string) => (digits.length > 1 && digits.startsWith("0")) || digits.length > MAX_SPELLED_DIGITS;

function englishWords(found: readonly Piece[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < found.length; i++) {
    const piece = found[i];
    if ("letters" in piece) {
      out.push(piece.letters);
      continue;
    }
    const { digits } = piece;
    const next = found[i + 1];
    const ending = next && "letters" in next ? next.letters : "";
    if (readOut(digits)) {
      out.push(...[...digits].map((digit) => ENGLISH_DIGITS[Number(digit)]));
    } else if (ORDINAL_ENDING.test(ending)) {
      out.push(...englishOrdinal(englishCardinal(Number(digits))));
      i++;
    } else {
      const number = Number(digits);
      const words = (digits.length === 4 && englishYear(number)) || englishCardinal(number);
      // "90s", "1980's": a decade.
      const decade = PLURAL_ENDING.test(ending) && number % 10 === 0;
      out.push(...(decade ? englishPlural(words) : words));
      if (decade) i++;
    }
  }
  return out;
}

/**
 * The words sung for a written number in `language`, or null when the text holds no digits: orthographic words
 * for English and the reader languages, one kana string for Japanese, pinyin syllables for Mandarin. `after` is
 * the text that follows the number, which picks Korean's native numbers before a counter.
 */
function numberWords(text: string, language: NumberLanguage, after = ""): string[] | null {
  const found = pieces(text);
  if (!found.some((piece) => "digits" in piece)) return null;
  if (language === "en") return englishWords(found);
  const speller = SPELLERS[language];
  const words = found.flatMap((piece) => {
    if ("letters" in piece) return [piece.letters];
    if (readOut(piece.digits)) return [...piece.digits].map((digit) => speller.digits[Number(digit)]);
    const number = Number(piece.digits);
    return (language === "ko" && koreanNative(number, after)) || speller.number(number);
  });
  // Korean and Japanese are written without spaces, and their sound rules run across the whole number.
  return language === "ko" || language === "ja" ? [words.join("")] : words;
}

// -- Exports ------------------------------------------------------------------

export { numberWords };
export type { NumberLanguage };
