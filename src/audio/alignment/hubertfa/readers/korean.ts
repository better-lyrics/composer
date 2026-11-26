import { isHangulBlock } from "@/domain/alignment/cjk";

// Korean: each Hangul block is decomposed arithmetically, the sound rules run
// across the whole word, and each block gets the sounds of the syllable sung on
// it (a final consonant carried over to the next vowel belongs to the next block).
// Rules, in order: carrying a final consonant over to a following vowel and
// simplifying the rest; ㅎ merging and dropping; palatalisation before 이;
// nasalisation and the ㄴ/ㄹ rules; tensing after a stop.

// -- Types --------------------------------------------------------------------

/** One syllable as jamo indices: initial 0-18 (11 is the silent ㅇ), medial 0-20, final 0-27 (0 is none). */
interface Syllable {
  initial: number;
  medial: number;
  final: number;
}

interface KoreanReading {
  /** Sounds for each Hangul block of the word, in order. */
  blocks: string[][];
  guessed: boolean;
}

// -- Constants ----------------------------------------------------------------

const FIRST_BLOCK = 0xac00;
const SILENT = 11;
// Initials: ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ.
const [G, GG, N, D, DD, R, M, B, BB, S, SS, , J, JJ, CH, K, T, P, H] = Array.from({ length: 19 }, (_, i) => i);
// Finals, by index: none ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㄷ ㄹ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅁ ㅂ ㅄ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ,
// each as the initials it is made of (a cluster is two).
const FINAL_PARTS: readonly (readonly number[])[] = [
  [],
  [G],
  [GG],
  [G, S],
  [N],
  [N, J],
  [N, H],
  [D],
  [R],
  [R, G],
  [R, M],
  [R, B],
  [R, S],
  [R, T],
  [R, P],
  [R, H],
  [M],
  [B],
  [B, S],
  [S],
  [SS],
  [-1],
  [J],
  [CH],
  [K],
  [T],
  [P],
  [H],
];
// The ㅇ final (ŋ) as a pseudo-initial; it never carries over.
const NG = -1;
// Which of the seven final sounds a lone final consonant is pronounced as.
const NEUTRAL: Readonly<Record<number, string>> = {
  [G]: "k",
  [GG]: "k",
  [K]: "k",
  [N]: "n",
  [D]: "t",
  [T]: "t",
  [S]: "t",
  [SS]: "t",
  [J]: "t",
  [CH]: "t",
  [H]: "t",
  [R]: "l",
  [M]: "m",
  [B]: "p",
  [P]: "p",
  [NG]: "ŋ",
};
// A cluster's sounded member when nothing carries over: ㄺ ㄻ ㄿ keep the second, the rest the first.
const CLUSTER_KEEPS_SECOND = new Set([9, 10, 14]);
const MEDIALS = [
  "a",
  "ɛ",
  "j a",
  "j ɛ",
  "ʌ",
  "e",
  "j ʌ",
  "j e",
  "o",
  "w a",
  "w ɛ",
  "w e",
  "j o",
  "u",
  "w ʌ",
  "w e",
  "w i",
  "j u",
  "ɯ",
  "ɯ i",
  "i",
];
const MEDIAL_I = 20;
// Medials that start with i or j, before which ㅅ is ɕ.
const PALATAL_MEDIALS = new Set([2, 3, 6, 7, 12, 16, 17, 20]);
const ASPIRATED_OF: Readonly<Record<number, number>> = { [G]: K, [D]: T, [B]: P, [J]: CH };
const SONORANTS = new Set([N, R, M, NG]);
const STOP_ASPIRATED: Readonly<Record<string, number>> = { k: K, t: T, p: P };
const TENSE_OF: Readonly<Record<number, number>> = { [G]: GG, [D]: DD, [B]: BB, [S]: SS, [J]: JJ };
const NASAL_OF: Readonly<Record<string, string>> = { k: "ŋ", t: "n", p: "m" };

// -- Functions ----------------------------------------------------------------

// Jamo written on their own ("ㅋㅋ"), which have no syllable to read.
function isLoneJamo(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x1100 && code <= 0x11ff) || (code >= 0x3131 && code <= 0x318e);
}

function decompose(char: string): Syllable {
  const code = (char.codePointAt(0) ?? FIRST_BLOCK) - FIRST_BLOCK;
  return { initial: Math.floor(code / 588), medial: Math.floor((code % 588) / 28), final: code % 28 };
}

/** One syllable after resyllabification: its onset initial (or null), medial and coda sound. */
interface Spoken {
  onset: number | null;
  medial: number;
  /** One of k t p n m ŋ l, or null. */
  coda: string | null;
}

// Carries finals over to a following vowel, merges ㅎ and simplifies what's left.
function resyllabify(syllables: readonly Syllable[]): Spoken[] {
  const spoken: Spoken[] = syllables.map((s) => ({
    onset: s.initial === SILENT ? null : s.initial,
    medial: s.medial,
    coda: null,
  }));
  syllables.forEach((syllable, i) => {
    let parts = [...FINAL_PARTS[syllable.final]];
    const next = spoken[i + 1];
    if (parts.length === 0) return;
    if (next && next.onset === null && parts[parts.length - 1] !== NG) {
      // ㅎ before a vowel is dropped; the consonant before it (ㄶ ㅀ) carries over instead.
      if (parts[parts.length - 1] === H) parts = parts.slice(0, -1);
      const moved = parts.pop();
      if (moved !== undefined) {
        // Palatalisation: ㄷ ㅌ carried onto 이 are ㅈ ㅊ.
        next.onset = next.medial === MEDIAL_I && (moved === D || moved === T) ? (moved === D ? J : CH) : moved;
      }
    } else if (next && next.onset !== null && parts.includes(H) && ASPIRATED_OF[next.onset] !== undefined) {
      // ㅎ final before ㄱ ㄷ ㅈ makes them aspirated.
      next.onset = ASPIRATED_OF[next.onset];
      parts = parts.filter((part) => part !== H);
    } else if (next && next.onset === H && STOP_ASPIRATED[NEUTRAL[parts[parts.length - 1]]] !== undefined) {
      // A stop final before ㅎ: the ㅎ makes it aspirated, at the start of the next syllable ("축하", "못해").
      const aspirated = STOP_ASPIRATED[NEUTRAL[parts.pop() ?? G]];
      next.onset = aspirated === T && next.medial === MEDIAL_I ? CH : aspirated;
    } else if (next && next.onset === H && SONORANTS.has(parts[parts.length - 1])) {
      // ㅎ after ㄴ ㄹ ㅁ ㅇ is dropped, and the consonant carries over ("원해", "말해"); ㅇ never does.
      next.onset = parts[parts.length - 1] === NG ? null : (parts.pop() ?? null);
    } else if (next && next.onset === S && parts.includes(H)) {
      next.onset = SS;
      parts = parts.filter((part) => part !== H);
    } else if (next && next.onset === N && parts[parts.length - 1] === H) {
      parts = [N];
    }
    const kept =
      parts.length === 2
        ? CLUSTER_KEEPS_SECOND.has(syllable.final) && !(syllable.final === 9 && next?.onset === G)
          ? parts[1]
          : parts[0]
        : parts[0];
    spoken[i].coda = kept === undefined ? null : NEUTRAL[kept];
  });
  return spoken;
}

// Nasalisation, the ㄴ/ㄹ rules and tensing, at each syllable boundary.
function assimilate(spoken: Spoken[]) {
  for (let i = 0; i + 1 < spoken.length; i++) {
    const here = spoken[i];
    const next = spoken[i + 1];
    if (!here.coda || next.onset === null) continue;
    if (next.onset === R && (here.coda === "n" || here.coda === "l")) {
      here.coda = "l";
      continue;
    }
    if (next.onset === R) next.onset = N;
    if (here.coda === "l" && next.onset === N) {
      next.onset = R;
      continue;
    }
    if ((next.onset === N || next.onset === M) && NASAL_OF[here.coda]) here.coda = NASAL_OF[here.coda];
    else if (NASAL_OF[here.coda] && TENSE_OF[next.onset] !== undefined) next.onset = TENSE_OF[next.onset];
  }
}

// An initial's sound. Plain stops and ㅈ are voiced between voiced sounds; ㄹ
// is l after an l coda and a tap otherwise; ㅅ is ɕ before i or j.
function onsetSound(onset: number, voicedBefore: boolean, afterL: boolean, medial: number): string {
  const voiced: Readonly<Record<number, readonly [string, string]>> = {
    [G]: ["k", "g"],
    [D]: ["t", "d"],
    [B]: ["p", "b"],
    [J]: ["tʃ", "dʒ"],
  };
  if (voiced[onset]) return voiced[onset][voicedBefore ? 1 : 0];
  if (onset === R) return afterL ? "l" : "ɾ";
  if (onset === S) return PALATAL_MEDIALS.has(medial) ? "ɕ" : "s";
  const fixed: Readonly<Record<number, string>> = {
    [GG]: "k*",
    [N]: "n",
    [DD]: "t*",
    [M]: "m",
    [BB]: "p*",
    [SS]: "s*",
    [JJ]: "tʃ*",
    [CH]: "tʃ",
    [K]: "kʰ",
    [T]: "tʰ",
    [P]: "pʰ",
    [H]: "h",
  };
  return fixed[onset];
}

/** The sounds of each Hangul block in a word. Characters that aren't Hangul blocks are skipped. */
function readKorean(word: string): KoreanReading {
  const chars = [...word];
  const syllables = chars.filter(isHangulBlock).map(decompose);
  const spoken = resyllabify(syllables);
  assimilate(spoken);
  const blocks = spoken.map((syllable, i) => {
    const before = spoken[i - 1];
    const voicedBefore = !!before && (before.coda === null || "nmŋl".includes(before.coda));
    const sounds: string[] = [];
    if (syllable.onset !== null) {
      sounds.push(onsetSound(syllable.onset, voicedBefore, before?.coda === "l", syllable.medial));
    }
    // ㅢ after a consonant is i, and later in a word it is the particle's e ("나의").
    const medial =
      syllable.medial !== 19 ? MEDIALS[syllable.medial] : syllable.onset !== null ? "i" : i > 0 ? "e" : "ɯ i";
    sounds.push(...medial.split(" "));
    if (syllable.coda) sounds.push(syllable.coda);
    return sounds;
  });
  return { blocks, guessed: chars.some(isLoneJamo) };
}

// -- Exports ------------------------------------------------------------------

export { readKorean };
