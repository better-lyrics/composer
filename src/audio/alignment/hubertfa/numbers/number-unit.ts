import type { ReadingUnit } from "@/audio/alignment/hubertfa/g2p";
import { kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { type NumberLanguage, numberWords } from "@/audio/alignment/hubertfa/numbers/number-words";
import { readWord } from "@/audio/alignment/hubertfa/readers/reader-units";
import { hasCjk } from "@/domain/alignment/cjk";
import type { HanReading, LatinReader } from "@/domain/alignment/language";
import { detectNonLatinLanguage, hasLatinLetter } from "@/domain/language/script-detection";

// A number is sung in the language of the words around it, which a song in
// two languages changes from line to line: "나는 17" is Korean, "I'm 17" in
// the same song is English.

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

// -- Functions ----------------------------------------------------------------

// The language a part's letters are sung in, or null when it has none.
function partLanguage(text: string, context: NumberContext): NumberLanguage | null {
  const script = detectNonLatinLanguage(text);
  if (script === "ko" || script === "ar") return script;
  if (hasCjk(text)) return context.hanReading;
  return hasLatinLetter(text) ? (context.latinReader ?? "en") : null;
}

/**
 * The language of the number on parts `first` to `last`: its own letters ("4ever"), then the rest of its word
 * ("17살"), then the nearest part with letters on either side, the one before winning a tie. A line of numbers
 * alone is read by the song's reader for Latin script, or as English.
 */
function numberLanguage(parts: readonly LinePart[], first: number, last: number, context: NumberContext) {
  const own = parts.slice(first, last + 1).some((part) => hasLatinLetter(part.text));
  if (own) return context.latinReader ?? "en";
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
  return byDistance(true) ?? byDistance(false) ?? context.latinReader ?? "en";
}

/** `unit` as the number it's written as, read in the language of its line; null when its text holds no digits. */
function numberUnit(unit: ReadingUnit, parts: readonly LinePart[], context: NumberContext): ReadingUnit | null {
  if (!ANY_DIGIT.test(unit.text)) return null;
  const first = unit.parts[0];
  const last = unit.parts[unit.parts.length - 1];
  const language = numberLanguage(parts, first, last, context);
  const next = parts[last + 1];
  const words = numberWords(unit.text, language, next?.word === parts[first].word ? next.text : "");
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
