import type { ReadingUnit } from "@/audio/alignment/hubertfa/g2p";
import { kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { startsWithKoreanCounter } from "@/audio/alignment/hubertfa/numbers/east-asian";
import { type NumberLanguage, numberWords } from "@/audio/alignment/hubertfa/numbers/number-words";
import { readWord } from "@/audio/alignment/hubertfa/readers/reader-units";
import { hasCjk } from "@/domain/alignment/cjk";
import type { HanReading, LatinReader } from "@/domain/alignment/language";
import { detectNonLatinLanguage, hasLatinLetter, isLetter } from "@/domain/language/script-detection";

// A number is sung in the language of the words around it, which a song in
// two languages changes from line to line: "17살" is Korean, "I'm 17" in the
// same song is English.

// -- Types --------------------------------------------------------------------

interface LinePart {
  text: string;
  /** Which word of the line the part belongs to. */
  word: number;
}

interface NumberContext {
  hanReading: HanReading;
  latinReader?: LatinReader | null;
}

// -- Constants ----------------------------------------------------------------

const ANY_DIGIT = /\p{Nd}/u;
// One point between digits: "99.9", "0.1".
const DECIMAL = /^\D*\d+\.\d+\D*$/;
// Three or more small numbers written as one word: "1,2,3". Groups of three digits are thousands ("1,000,000").
const COUNT_LIST = /^\d{1,2}(?:,\d{1,2}){2,},?$/;
// Where the two other words of a count of three can be, from a number's own word.
const COUNT_NEIGHBOURS = [
  [-2, -1],
  [-1, 1],
  [1, 2],
];

// -- Functions ----------------------------------------------------------------

// The language a part's letters are sung in, or null when it has none.
function partLanguage(text: string, context: NumberContext): NumberLanguage | null {
  const script = detectNonLatinLanguage(text);
  if (script === "ko" || script === "ar") return script;
  if (hasCjk(text)) return context.hanReading;
  return hasLatinLetter(text) ? (context.latinReader ?? "en") : null;
}

// Whether word `word` of the line is a number and nothing else ("2,").
function isNumberWord(parts: readonly LinePart[], word: number): boolean {
  const own = parts.filter((part) => part.word === word);
  return own.length > 0 && own.every((part) => ANY_DIGIT.test(part.text) && ![...part.text].some(isLetter));
}

/**
 * The language of the number on parts `first` to `last`: its own letters ("4ever"), then the rest of its word
 * ("17살"), then the nearest part with letters on either side, the one before winning a tie. A line of numbers
 * alone is read by the song's reader for Latin script, or as English. Beside Korean words a number on its own is
 * English too, unless a counter starts `after`, the text that follows it, or it is a decimal.
 */
function numberLanguage(
  parts: readonly LinePart[],
  first: number,
  last: number,
  after: string,
  context: NumberContext,
) {
  const own = parts.slice(first, last + 1).map((part) => part.text);
  const fallback = context.latinReader ?? "en";
  if (own.some(hasLatinLetter)) return fallback;
  const { word } = parts[first];
  const byDistance = (sameWord: boolean) => {
    for (let distance = 1; distance < parts.length; distance++) {
      for (const index of [first - distance, last + distance]) {
        const part = parts[index];
        if (!part || (sameWord && part.word !== word)) continue;
        const language = partLanguage(part.text, context);
        if (language) return language;
      }
    }
    return null;
  };
  const inWord = byDistance(true);
  if (inWord) return inWord;
  const nearest = byDistance(false) ?? fallback;
  // A number that stands on its own beside Korean words is mostly sung in English ("너만이 가득한 4 Walls",
  // "1, 2, 3", "24/7"): measured against the audio of 288 lines, English unless a counter follows or it is a decimal
  // fits 92% of them, the nearest word's language 78% (hubertfa-posttrain results/trainv3/number_lang). Japanese,
  // Chinese and Arabic showed nothing better than the nearest word.
  // A count of three or more ("1, 2, 3 시작", "1,2,3 시작") stays English whatever follows: 시작 only starts like
  // the counter for hours. Two numbers before a counter are a range ("2, 3 번", two or three times) and are not.
  const counted =
    COUNT_LIST.test(own.join("")) ||
    COUNT_NEIGHBOURS.some(([a, b]) => isNumberWord(parts, word + a) && isNumberWord(parts, word + b));
  const counter = !counted && startsWithKoreanCounter(after);
  const korean = nearest === "ko" && (counter || DECIMAL.test(own.join("")));
  return nearest === "ko" && !korean ? fallback : nearest;
}

/** `unit` as the number it's written as, read in the language of its line; null when its text holds no digits. */
function numberUnit(unit: ReadingUnit, parts: readonly LinePart[], context: NumberContext): ReadingUnit | null {
  if (!ANY_DIGIT.test(unit.text)) return null;
  const first = unit.parts[0];
  const last = unit.parts[unit.parts.length - 1];
  // What follows the number, where Korean writes its counter: the rest of its word ("3마리"), or the next word
  // when the number ends its own ("17 살").
  const rest = parts.slice(last + 1);
  const after = rest
    .filter((part) => part.word === rest[0].word)
    .map((part) => part.text)
    .join("");
  const language = numberLanguage(parts, first, last, after, context);
  const words = numberWords(unit.text, language, after);
  if (!words) return null;
  const spoken = words.join(" ");
  if (language === "en") return { ...unit, spoken };
  if (language === "ja") return { ...unit, language, spoken, reading: kanaToMorae(words.join("")) };
  if (language === "zh") return { ...unit, language, spoken, reading: words };
  // Each word is read on its own, as the reader would read it in a line.
  const sounds = words.flatMap((word) => readWord(language, word).sounds);
  return { ...unit, language: "reader", spoken, read: { parts: unit.parts, reader: language, sounds, guessed: true } };
}

// -- Exports ------------------------------------------------------------------

export { numberUnit };
