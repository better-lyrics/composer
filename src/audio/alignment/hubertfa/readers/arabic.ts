import { type WordReading, finishSounds } from "@/audio/alignment/hubertfa/readers/spelling";
import { isLetter } from "@/domain/language/script-detection";

// Arabic, best effort. Consonants one to one, the emphatics as their plain
// versions; long vowels from ا و ي; short-vowel marks honoured when written and
// never guessed when they aren't; the l of ال assimilated before a sun letter.

// -- Constants ----------------------------------------------------------------

const CONSONANTS: Readonly<Record<string, string>> = {
  ء: "ʔ",
  أ: "ʔ",
  إ: "ʔ",
  ؤ: "ʔ",
  ئ: "ʔ",
  ب: "b",
  ت: "t",
  ث: "θ",
  ج: "dʒ",
  ح: "ħ",
  خ: "x",
  د: "d",
  ذ: "ð",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "ʃ",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "ð",
  ع: "ʕ",
  غ: "ɣ",
  ف: "f",
  ق: "q",
  ك: "k",
  ک: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ھ: "h",
  ہ: "h",
  پ: "p",
  چ: "tʃ",
  گ: "g",
  ڤ: "v",
};
const MARKS: Readonly<Record<string, string>> = {
  "\u064e": "a",
  "\u0650": "i",
  "\u064f": "u",
  "\u064b": "a n",
  "\u064d": "i n",
  "\u064c": "u n",
  "\u0670": "a",
};
// Sukun, shadda (a doubled consonant is one sound), tatweel and Quranic marks: nothing to sing.
const SILENT_MARKS = new Set(["\u0652", "\u0651", "\u0640", "\u0653", "\u0654", "\u0655"]);
const SUN_LETTERS = new Set([..."تثدذرزسشصضطظلن"]);
const PREFIXES = ["و", "ف", "ب", "ك", "ل"];
const VOWEL_SOUNDS = new Set(["a", "i", "u"]);

// -- Functions ----------------------------------------------------------------

const isMark = (char: string) => MARKS[char] !== undefined || SILENT_MARKS.has(char);

// Where the article ال starts, alone or after one prefix letter ("وال", "بال"); -1 when there is none.
function articleAt(letters: readonly string[]): number {
  if (letters[0] === "ا" && letters[1] === "ل") return 0;
  if (PREFIXES.includes(letters[0]) && letters[1] === "ا" && letters[2] === "ل") return 1;
  return -1;
}

function readArabic(word: string): WordReading {
  // NFKC folds presentation forms (ﻻ, ﺍ) into the letters they draw.
  const chars = [...word.normalize("NFKC")];
  const letters = chars.filter((char) => !isMark(char));
  const article = articleAt(letters);
  const sounds: string[] = [];
  let guessed = false;
  let letterIndex = -1;
  const last = () => sounds[sounds.length - 1];
  const push = (sound: string) => {
    if (sound && sound !== last()) sounds.push(sound);
  };

  for (let k = 0; k < chars.length; k++) {
    const char = chars[k];
    if (MARKS[char]) {
      sounds.push(...MARKS[char].split(" "));
      continue;
    }
    if (SILENT_MARKS.has(char)) continue;
    letterIndex++;
    const before = letters[letterIndex - 1];
    const after = letters[letterIndex + 1];
    const marked = isMark(chars[k + 1] ?? "");
    if (article >= 0 && letterIndex === article + 1 && after && SUN_LETTERS.has(after)) continue;
    if (char === "ا" || char === "ى" || char === "ٱ") {
      // A final ا after و is the silent alif of a plural verb ("كتبوا").
      if (!(char === "ا" && before === "و" && !after)) push("a");
      continue;
    }
    if (char === "آ") {
      sounds.push("ʔ", "a");
      continue;
    }
    if (char === "ة") {
      if (!VOWEL_SOUNDS.has(last() ?? "")) push("a");
      continue;
    }
    if (char === "و" || char === "ي" || char === "ی") {
      const [consonant, vowel] = char === "و" ? ["w", "u"] : ["j", "i"];
      // A consonant at the start, after a vowel, before ا or another weak letter ("عيون"), or with its own vowel
      // mark; else a long vowel.
      const beforeWeak = (after === "و" || after === "ي") && letters[letterIndex + 2] !== undefined;
      const isConsonant =
        letterIndex === 0 ||
        VOWEL_SOUNDS.has(last() ?? "") ||
        after === "ا" ||
        beforeWeak ||
        (marked && chars[k + 1] !== "\u0652");
      sounds.push(isConsonant ? consonant : vowel);
      continue;
    }
    const consonant = CONSONANTS[char];
    if (consonant) push(consonant);
    else if (isLetter(char)) guessed = true;
  }
  // A w or j before no vowel joins the vowel before it ("بَيْت" bajt) or is its long vowel.
  return { sounds: finishSounds(sounds, { glide: false, diphthongs: "never" }), guessed };
}

// -- Exports ------------------------------------------------------------------

export { readArabic };
