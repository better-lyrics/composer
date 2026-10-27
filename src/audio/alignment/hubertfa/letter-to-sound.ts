// A rough English pronunciation from spelling, for words the dictionary lacks
// (ad-libs like "yuh", slang, names). Alignment only needs phones close enough
// to find the word's span between its neighbours, so a handful of spelling
// rules beats giving up on the whole line.

// -- Constants ----------------------------------------------------------------

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// Letter groups read as one sound, tried longest first.
const GROUPS: Record<string, string[]> = {
  tion: ["sh", "ax", "n"],
  igh: ["ay"],
  tch: ["ch"],
  dge: ["jh"],
  sh: ["sh"],
  ch: ["ch"],
  th: ["th"],
  ph: ["f"],
  wh: ["w"],
  ck: ["k"],
  ng: ["ng"],
  qu: ["k", "w"],
  ee: ["iy"],
  ea: ["iy"],
  oo: ["uw"],
  ou: ["aw"],
  ow: ["ow"],
  ai: ["ey"],
  ay: ["ey"],
  oa: ["ow"],
  oi: ["oy"],
  oy: ["oy"],
  au: ["ao"],
  aw: ["ao"],
  er: ["er"],
  ir: ["er"],
  ur: ["er"],
  ar: ["aa", "r"],
  or: ["ao", "r"],
};
const GROUP_LENGTHS = [4, 3, 2];

const LETTERS: Record<string, string[]> = {
  a: ["ae"],
  b: ["b"],
  c: ["k"],
  d: ["d"],
  e: ["eh"],
  f: ["f"],
  g: ["g"],
  h: ["hh"],
  i: ["ih"],
  j: ["jh"],
  k: ["k"],
  l: ["l"],
  m: ["m"],
  n: ["n"],
  o: ["aa"],
  p: ["p"],
  q: ["k"],
  r: ["r"],
  s: ["s"],
  t: ["t"],
  u: ["ah"],
  v: ["v"],
  w: ["w"],
  x: ["k", "s"],
  y: ["y"],
  z: ["z"],
};

// A vowel made long by a silent final e: "cute", "mine", "pose".
const LONG_VOWELS: Record<string, string[]> = {
  a: ["ey"],
  e: ["iy"],
  i: ["ay"],
  o: ["ow"],
  u: ["uw"],
};

/** Every phone a guess can contain, so a test can hold them to the model's vocabulary. */
const LETTER_PHONES = [
  ...new Set(
    [GROUPS, LETTERS, LONG_VOWELS, { s: ["s"], c: ["s"], y: ["iy", "ih"] }].flatMap((t) => Object.values(t).flat()),
  ),
];

// -- Functions ----------------------------------------------------------------

const isVowel = (letter: string | undefined) => letter !== undefined && VOWELS.has(letter);

// Index of a vowel lengthened by a silent final e ("mine" -> 1), or -1.
function magicEVowel(letters: string): number {
  const n = letters.length;
  if (n < 3 || letters[n - 1] !== "e" || isVowel(letters[n - 2]) || !isVowel(letters[n - 3])) return -1;
  return isVowel(letters[n - 4]) ? -1 : n - 3;
}

// `spelled` still has the silent final e, which softens a c before it ("ice").
function letterPhones(letters: string, spelled: string, i: number, longVowel: number): string[] {
  const letter = letters[i];
  const next = spelled[i + 1];
  if (i === longVowel) return LONG_VOWELS[letter];
  if (letter === "c" && (next === "e" || next === "i" || next === "y")) return ["s"];
  // "h" is only heard before a vowel: "yuh", "ohh".
  if (letter === "h" && !isVowel(next) && next !== "y") return [];
  if (letter === "y" && i > 0) return i === letters.length - 1 ? ["iy"] : ["ih"];
  return LETTERS[letter] ?? [];
}

/** Phones for a word read by its spelling, or null when it has no letters to read. */
function guessPhones(word: string): string[] | null {
  const spelled = word.toLowerCase().replace(/[^a-z]/g, "");
  const longVowel = magicEVowel(spelled);
  let letters = spelled;
  // A final e is silent when the word has another vowel ("pose", "the" aside).
  if (letters.length > 2 && letters.endsWith("e") && /[aeiouy]/.test(letters.slice(0, -1))) {
    letters = letters.slice(0, -1);
  }
  const phones: string[] = [];
  let i = 0;
  while (i < letters.length) {
    // Doubled consonants are one sound: "mutt", "yall".
    if (i > 0 && letters[i] === letters[i - 1] && !isVowel(letters[i])) {
      i++;
      continue;
    }
    const length = i === longVowel ? undefined : GROUP_LENGTHS.find((n) => GROUPS[letters.slice(i, i + n)]);
    if (length) {
      phones.push(...GROUPS[letters.slice(i, i + length)]);
      i += length;
      continue;
    }
    phones.push(...letterPhones(letters, spelled, i, longVowel));
    i++;
  }
  return phones.length > 0 ? phones : null;
}

// -- Exports ------------------------------------------------------------------

export { LETTER_PHONES, guessPhones };
