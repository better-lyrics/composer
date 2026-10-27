// Plurals, past tenses and -ing forms of dictionary words that are missing
// themselves ("posers", "karats", "mashin'"): the stem's phones plus the ending.

// -- Types --------------------------------------------------------------------

type StemLookup = (stem: string) => string[] | undefined;

// -- Constants ----------------------------------------------------------------

const VOICELESS = new Set(["p", "t", "k", "f", "th"]);
const SIBILANTS = new Set(["s", "z", "sh", "zh", "ch", "jh"]);

// -- Functions ----------------------------------------------------------------

function pluralEnding(last: string): string[] {
  if (SIBILANTS.has(last)) return ["ih", "z"];
  return VOICELESS.has(last) ? ["s"] : ["z"];
}

function pastEnding(last: string): string[] {
  if (last === "t" || last === "d") return ["ih", "d"];
  return VOICELESS.has(last) || SIBILANTS.has(last) ? ["t"] : ["d"];
}

// The stem as written, with its silent e put back, or with a doubled consonant undone.
function findStem(stem: string, lookup: StemLookup): string[] | undefined {
  const undoubled = stem.length > 2 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : null;
  return lookup(stem) ?? lookup(`${stem}e`) ?? (undoubled ? lookup(undoubled) : undefined);
}

function withEnding(
  word: string,
  suffix: string,
  lookup: StemLookup,
  ending: (last: string) => string[],
): string[] | null {
  if (word.length <= suffix.length + 1 || !word.endsWith(suffix)) return null;
  const phones = findStem(word.slice(0, -suffix.length), lookup);
  return phones ? [...phones, ...ending(phones[phones.length - 1])] : null;
}

/** Phones for an inflected form of a dictionary word (without trailing apostrophes), or null. */
function lookupInflected(bare: string, lookup: StemLookup): string[] | null {
  return (
    withEnding(bare, "ing", lookup, () => ["ih", "ng"]) ??
    withEnding(bare, "in", lookup, () => ["ih", "n"]) ??
    withEnding(bare, "es", lookup, pluralEnding) ??
    withEnding(bare, "s", lookup, pluralEnding) ??
    withEnding(bare, "ed", lookup, pastEnding) ??
    withEnding(bare, "d", lookup, pastEnding)
  );
}

// -- Exports ------------------------------------------------------------------

export { lookupInflected };
