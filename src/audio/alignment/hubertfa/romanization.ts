// Romanized lyrics (the project's transliteration track) → the units HubertFA's
// dictionaries are keyed by: Japanese romaji morae and toneless pinyin.

// -- Constants ----------------------------------------------------------------

const VOWELS = "aeiou";
// Long vowels written with a macron or circumflex are sung as two morae.
const LONG_VOWELS: Record<string, string> = {
  ā: "aa",
  ī: "ii",
  ū: "uu",
  ē: "ee",
  ō: "oo",
  â: "aa",
  î: "ii",
  û: "uu",
  ê: "ee",
  ô: "oo",
};
// Kunrei spellings with no Hepburn reading of their own.
const KUNREI: Record<string, string> = {
  si: "shi",
  tu: "tsu",
  hu: "fu",
  zi: "ji",
  sya: "sha",
  syu: "shu",
  syo: "sho",
  zya: "ja",
  zyu: "ju",
  zyo: "jo",
  tya: "cha",
  tyu: "chu",
  tyo: "cho",
};
const CLOSURE = "cl";

// -- Functions ----------------------------------------------------------------

function stripMarks(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

const WORD_SEPARATORS = /[^a-z']+/;

/** Lowercase Latin words without apostrophes ("Ay-yeah" → ay, yeah), as an English word appears in a romanization. */
function plainWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SEPARATORS)
    .map((word) => word.replaceAll("'", ""))
    .filter(Boolean);
}

function romajiWords(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[āīūēōâîûêô]/g, (c) => LONG_VOWELS[c])
    .split(WORD_SEPARATORS)
    .filter(Boolean);
}

/**
 * One romaji word → mora keys ("kitte" → ki cl te, "konnichiwa" → ko n ni
 * chi wa). `isMora` says which spellings the dictionary has. Returns null
 * when the word isn't readable as romaji (an English word, say).
 */
function romajiToMorae(word: string, isMora: (key: string) => boolean): string[] | null {
  const text = word.replaceAll("'", "|");
  const morae: string[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "|") {
      i++;
      continue;
    }
    const next = text[i + 1];
    // Doubled consonant (or "tch") is the closure っ.
    if (!VOWELS.includes(c) && c !== "n" && (next === c || (c === "t" && next === "c"))) {
      morae.push(CLOSURE);
      i++;
      continue;
    }
    // ん: n not starting a mora, or m before b/p/m.
    if (
      (c === "n" && (next === undefined || next === "|" || (!VOWELS.includes(next) && next !== "y"))) ||
      (c === "m" && "bpm".includes(next ?? "-"))
    ) {
      morae.push("n");
      i++;
      continue;
    }
    let matched = false;
    for (const length of [3, 2, 1]) {
      const piece = text.slice(i, i + length);
      const key = KUNREI[piece] ?? piece;
      if (piece.length === length && isMora(key)) {
        morae.push(key);
        i += length;
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return morae;
}

/** Romanized line → words, each as morae or null when it isn't romaji. */
function romajiLine(text: string, isMora: (key: string) => boolean): { word: string; morae: string[] | null }[] {
  return romajiWords(text).map((word) => ({ word, morae: romajiToMorae(word, isMora) }));
}

/**
 * Pinyin (with or without tone marks or numbers) → toneless syllables as the
 * dictionary spells them ("nǚ" → "nv"). Syllables must be separated, which
 * is how romanized lyrics are written.
 */
function pinyinSyllables(text: string): string[] {
  const normalized = text
    .normalize("NFC")
    .replace(/[ǖǘǚǜü]/g, "v")
    .replace(/u:/g, "v");
  return stripMarks(normalized)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// -- Exports ------------------------------------------------------------------

export { pinyinSyllables, plainWords, romajiLine, romajiToMorae, stripMarks };
