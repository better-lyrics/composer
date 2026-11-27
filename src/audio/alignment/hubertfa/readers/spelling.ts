import { stripMarks } from "@/audio/alignment/hubertfa/romanization";
import { isLetter } from "@/domain/language/script-detection";

// The machinery the Latin-script readers share: ordered spelling rules matched
// at each letter, then the passes every reader applies to the sounds (glides
// before vowels, diphthongs within a syllable, a doubled consonant as one).
// These are sung lyrics feeding forced alignment: the count and broad class of
// sounds matter, so there is no stress and no vowel length.

// -- Types --------------------------------------------------------------------

/** Where a rule matched: `word[at..end)`. */
interface Spot {
  word: string;
  at: number;
  end: number;
}

interface Rule {
  /** The letters the rule consumes. */
  letters: string;
  /** Sound keys, space-separated; "" for silent letters. A vowel ending in `!` never becomes a glide. */
  sounds: string | ((spot: Spot) => string);
  when?: (spot: Spot) => boolean;
}

/** Rules grouped by first letter, in the order they're tried. */
type RuleSet = ReadonlyMap<string, readonly Rule[]>;

interface WordReading {
  sounds: string[];
  /** True when a letter had no rule and was read as its base letter or skipped. */
  guessed: boolean;
}

interface GlideOptions {
  /** Whether a weak `i`/`u` before another vowel becomes `j`/`w`. */
  glide: boolean;
  /**
   * Where a vowel and a following weak `i`/`u` share a syllable: anywhere, only at the end of a word
   * ("pantai" but not "main"), or never (a written `j`/`w` still joins the vowel before it).
   */
  diphthongs: "anywhere" | "final" | "never";
}

// -- Constants ----------------------------------------------------------------

const VOWEL_SOUNDS = new Set(
  "i ɪ y ʏ ɯ u ʊ e ɛ ø œ o ɔ ə ɐ a ɑ ʌ æ ɑ~ ɔ~ ɛ~ œ~ ɐ~ e~ i~ o~ u~ aj aw oj ej ow ɐ~w ɐ~j o~j e~j".split(" "),
);
// The vowel a diphthong is written from, for each vowel that can start one.
const DIPHTHONG_BASE: Readonly<Record<string, string>> = { a: "a", ɑ: "a", ɐ: "a", e: "e", ɛ: "e", o: "o", ɔ: "o" };
const DIPHTHONGS = new Set(["aj", "aw", "oj", "ej", "ow"]);

// -- Functions ----------------------------------------------------------------

function compileRules(rules: readonly Rule[]): RuleSet {
  const grouped = new Map<string, Rule[]>();
  for (const rule of rules) {
    const first = rule.letters[0];
    grouped.set(first, [...(grouped.get(first) ?? []), rule]);
  }
  // Longer spellings first, and a rule with a condition before the plain fallback of its length.
  for (const group of grouped.values()) {
    group.sort((a, b) => b.letters.length - a.letters.length || Number(!a.when) - Number(!b.when));
  }
  return grouped;
}

/** Rules for letters read as the sound of the same name. */
const sameLetters = (letters: string): Rule[] => [...letters].map((letter) => ({ letters: letter, sounds: letter }));

/** Rules for accented vowels, given as pairs ("áa ée"), whose vowel never becomes a glide. */
const strongVowels = (pairs: string): Rule[] =>
  pairs.split(" ").map((pair) => {
    const [letter, ...sound] = [...pair];
    return { letters: letter, sounds: `${sound.join("")}!` };
  });

const isVowelSound = (sound: string | undefined) => sound !== undefined && VOWEL_SOUNDS.has(sound.replace("!", ""));

/** Letters only, lowercased: anything else splits the word into pieces read on their own. */
function letterPieces(word: string): { text: string; elided: boolean }[] {
  const pieces: { text: string; elided: boolean }[] = [];
  let run = "";
  for (const char of word.normalize("NFC").toLowerCase()) {
    if (isLetter(char)) {
      run += char;
      continue;
    }
    if (run) pieces.push({ text: run, elided: char === "'" || char === "’" });
    run = "";
  }
  if (run) pieces.push({ text: run, elided: false });
  return pieces;
}

function matchRule(rules: RuleSet, word: string, at: number): { rule: Rule; spot: Spot } | null {
  for (const rule of rules.get(word[at]) ?? []) {
    const end = at + rule.letters.length;
    if (word.slice(at, end) !== rule.letters) continue;
    const spot = { word, at, end };
    if (!rule.when || rule.when(spot)) return { rule, spot };
  }
  return null;
}

/** One piece's raw sounds. A letter with no rule is read as its base letter, else skipped. */
function applyRules(piece: string, rules: RuleSet): WordReading {
  let word = piece;
  const sounds: string[] = [];
  let guessed = false;
  let at = 0;
  while (at < word.length) {
    let match = matchRule(rules, word, at);
    if (!match) {
      const base = stripMarks(word[at]);
      if (base !== word[at] && base.length === 1) {
        word = word.slice(0, at) + base + word.slice(at + 1);
        match = matchRule(rules, word, at);
      }
      guessed = true;
      if (!match) {
        at++;
        continue;
      }
    }
    const { rule, spot } = match;
    const said = typeof rule.sounds === "string" ? rule.sounds : rule.sounds(spot);
    if (said) sounds.push(...said.split(" "));
    at = spot.end;
  }
  return { sounds, guessed };
}

// Weak i/u before a vowel become j/w; a vowel and a following weak i/u share a
// syllable as a diphthong; a j/w left before no vowel joins the vowel before it.
function finishSounds(raw: readonly string[], options: GlideOptions): string[] {
  const out: string[] = [];
  // A doubled consonant (or glide) is one sound.
  const push = (sound: string) => {
    if (isVowelSound(sound) || sound !== out[out.length - 1]) out.push(sound);
  };
  for (let k = 0; k < raw.length; k++) {
    const sound = raw[k];
    const next = raw[k + 1];
    if (options.glide && (sound === "i" || sound === "u") && isVowelSound(next)) {
      push(sound === "i" ? "j" : "w");
      continue;
    }
    const written = sound === "j" || sound === "w";
    const vowelGlide = (sound === "i" || sound === "u") && !isVowelSound(next);
    const mayJoin =
      written || (vowelGlide && (options.diphthongs === "anywhere" || (options.diphthongs === "final" && !next)));
    const base = DIPHTHONG_BASE[(out[out.length - 1] ?? "").replace("!", "")];
    const diphthong = base && `${base}${sound === "i" || sound === "j" ? "j" : "w"}`;
    if (mayJoin && !isVowelSound(next) && diphthong && DIPHTHONGS.has(diphthong)) {
      out[out.length - 1] = diphthong;
      continue;
    }
    if (written && !isVowelSound(next)) {
      const vowel = sound === "j" ? "i" : "u";
      if (out[out.length - 1] !== vowel) out.push(vowel);
      continue;
    }
    push(sound);
  }
  return out.map((sound) => sound.replace("!", ""));
}

/** A piece's reading from a language's exceptions table (sound keys, space-separated), or null when unlisted. */
function listedReading(piece: string, exceptions: Readonly<Record<string, string>>): WordReading | null {
  const listed = Object.hasOwn(exceptions, piece) ? exceptions[piece] : undefined;
  if (listed === undefined) return null;
  return { sounds: listed ? listed.split(" ") : [], guessed: false };
}

/** Reads a word piece by piece with one language's rules. */
function readWithRules(
  word: string,
  readPiece: (piece: string, elided: boolean) => WordReading,
  options: GlideOptions,
): WordReading {
  const sounds: string[] = [];
  let guessed = false;
  // Each piece is finished on its own: "uh-oh" is two syllables, never a glide across the hyphen.
  for (const { text, elided } of letterPieces(word)) {
    const piece = readPiece(text, elided);
    sounds.push(...finishSounds(piece.sounds, options));
    guessed ||= piece.guessed;
  }
  return { sounds, guessed };
}

// -- Context helpers ----------------------------------------------------------

const letterAfter = (spot: Spot, k = 0) => spot.word[spot.end + k] ?? "";
const letterBefore = (spot: Spot) => spot.word[spot.at - 1] ?? "";
const atWordEnd = (spot: Spot) => spot.end === spot.word.length;
const atWordStart = (spot: Spot) => spot.at === 0;

/** Context checks for one language's vowel letters and the front vowels that soften c and g. */
function letterClasses(vowels: string, front = "") {
  const vowelSet = new Set([...vowels]);
  const frontSet = new Set([...front]);
  const isVowelLetter = (letter: string) => vowelSet.has(letter);
  return {
    isVowelLetter,
    beforeVowel: (spot: Spot) => isVowelLetter(letterAfter(spot)),
    afterVowel: (spot: Spot) => isVowelLetter(letterBefore(spot)),
    beforeFront: (spot: Spot) => frontSet.has(letterAfter(spot)),
  };
}

// -- Exports ------------------------------------------------------------------

export {
  applyRules,
  atWordEnd,
  atWordStart,
  compileRules,
  finishSounds,
  letterAfter,
  letterBefore,
  letterClasses,
  listedReading,
  readWithRules,
  sameLetters,
  strongVowels,
};
export type { Rule, Spot, WordReading };
