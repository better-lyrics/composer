import { stripMarks } from "@/audio/alignment/hubertfa/romanization";
import { hasLetterOrDigit } from "@/domain/alignment/cjk";

// Word → phone lookup against HubertFA's English dictionary (ds_cmudict-07b).
// Mirrors the benchmark's normalisation so lyric spellings like "Don’t,",
// "lovin'" and "oh-oh" find an entry. Words with no entry are reported rather
// than dropped: dropping one shifts every later word in the line.

// -- Types --------------------------------------------------------------------

type Pronunciations = Map<string, string[]>;

type Lookup = { kind: "phones"; phones: string[] } | { kind: "silent" } | { kind: "unknown"; key: string };

// -- Constants ----------------------------------------------------------------

const CONTRACTION_SUFFIXES = ["n't", "'re", "'ll", "'ve", "'s", "'d", "'m"];
// Lyric spellings the dictionary doesn't have, as phones (ARPAbet, schwa as ax).
const LYRIC_SPELLINGS: Record<string, string[]> = {
  woah: ["w", "ow"],
  tryna: ["t", "r", "ay", "n", "ax"],
  imma: ["ay", "m", "ax"],
  finna: ["f", "ih", "n", "ax"],
  cuz: ["k", "ax", "z"],
  coz: ["k", "ax", "z"],
};

// -- Functions ----------------------------------------------------------------

function parseDictionary(text: string): Pronunciations {
  const entries: Pronunciations = new Map();
  for (const line of text.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    const word = line.slice(0, tab).trim();
    const phones = line
      .slice(tab + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (word && phones.length > 0 && !entries.has(word)) entries.set(word, phones);
  }
  return entries;
}

function normalizeWord(word: string): string {
  return stripMarks(word.normalize("NFKC"))
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^a-z0-9'\- ]/g, "")
    .replace(/^-+|-+$/g, "");
}

// Spellings to try, best first: as written, without edge apostrophes,
// g-dropping restored ("lovin'" → "loving"), apostrophes removed, and a
// missing contraction apostrophe put back ("thats" → "that's").
function spellingVariants(word: string): string[] {
  const bare = word.replace(/^'+|'+$/g, "");
  const variants = [word, bare];
  if (word.endsWith("in'")) variants.push(`${word.slice(0, -1)}g`);
  variants.push(bare.replaceAll("'", ""));
  const plain = bare.replaceAll("'", "");
  for (const suffix of CONTRACTION_SUFFIXES) {
    const letters = suffix.replace("'", "");
    if (plain.length > letters.length && plain.endsWith(letters)) {
      const stem = plain.slice(0, plain.length - letters.length);
      variants.push(suffix === "n't" ? `${stem}n't` : `${stem}${suffix}`);
    }
  }
  return variants.filter((v) => v.length > 0);
}

function lookupNormalized(word: string, dictionary: Pronunciations): string[] | null {
  const exact = dictionary.get(word) ?? LYRIC_SPELLINGS[word];
  if (exact) return [...exact];
  // "lovin'" / "lovin" sound like "loving" with the final ng sung as n.
  const stem = word.replace(/'+$/, "");
  const withG = dictionary.get(`${stem}g`);
  if (stem.endsWith("in") && withG) {
    const phones = [...withG];
    if (phones[phones.length - 1] === "ng") phones[phones.length - 1] = "n";
    return phones;
  }
  for (const variant of spellingVariants(word)) {
    const hit = dictionary.get(variant);
    if (hit) return [...hit];
  }
  if (/[- ]/.test(word)) {
    const phones: string[] = [];
    for (const piece of word.split(/[- ]+/).filter(Boolean)) {
      const hit = lookupNormalized(piece, dictionary);
      if (!hit) return null;
      phones.push(...hit);
    }
    return phones;
  }
  return null;
}

// Punctuation and symbols ("—", "♪") are silent. A word in a script the
// dictionary doesn't cover is unknown, not silent, so its line falls back
// instead of being aligned as if it had no lyrics.
function lookupWord(word: string, dictionary: Pronunciations): Lookup {
  if (!hasLetterOrDigit(word)) return { kind: "silent" };
  const key = normalizeWord(word);
  if (!/[a-z0-9]/.test(key)) return { kind: "unknown", key: word.trim() };
  const phones = lookupNormalized(key, dictionary);
  return phones ? { kind: "phones", phones } : { kind: "unknown", key };
}

// -- Exports ------------------------------------------------------------------

export { lookupWord, parseDictionary };
export type { Pronunciations };
