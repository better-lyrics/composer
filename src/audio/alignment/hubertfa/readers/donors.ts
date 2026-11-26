import table from "@/audio/alignment/hubertfa/readers/phone-donors.json";

// The readers emit sounds from one fixed inventory and know nothing about
// models. This table turns each sound into the nearest phones a loaded model
// has. Training real phones for a language changes this table, never a reader.

// -- Types --------------------------------------------------------------------

/** A language the models have phones for. */
type PhoneLanguage = "en" | "zh" | "ja";

interface ModelPhone {
  language: PhoneLanguage;
  phone: string;
}

type Candidate = readonly [string, readonly string[]];

// -- Constants ----------------------------------------------------------------

const PHONE_LANGUAGES = new Set<string>(["en", "zh", "ja"]);
const DONORS: ReadonlyMap<string, readonly Candidate[]> = new Map(
  Object.entries(table.sounds).map(([sound, candidates]) => [sound, candidates.map(parseCandidate)]),
);

// -- Functions ----------------------------------------------------------------

function parseCandidate(candidate: readonly unknown[]): Candidate {
  const [language, phones] = candidate;
  if (typeof language !== "string" || !Array.isArray(phones) || !phones.every((p) => typeof p === "string")) {
    throw new Error(`Malformed donor candidate ${JSON.stringify(candidate)}`);
  }
  return [language, phones];
}

function isPhoneLanguage(language: string): language is PhoneLanguage {
  return PHONE_LANGUAGES.has(language);
}

function isKnownSound(sound: string): boolean {
  return DONORS.has(sound);
}

/**
 * The model phones for one sound: its first candidate in a language the model
 * lists. Every sound ends on an English candidate, which every model has.
 */
function donorPhones(sound: string, modelLanguages: ReadonlySet<string>): ModelPhone[] {
  const candidates = DONORS.get(sound);
  if (!candidates) throw new Error(`No donor phones for sound ${JSON.stringify(sound)}`);
  const pick = candidates.find(([language]) => modelLanguages.has(language)) ?? candidates[candidates.length - 1];
  const [language, phones] = pick;
  if (!isPhoneLanguage(language)) throw new Error(`Donor language ${language} has no model phones`);
  return phones.map((phone) => ({ language, phone }));
}

function soundsToPhones(sounds: readonly string[], modelLanguages: readonly string[]): ModelPhone[] {
  const listed = new Set(modelLanguages);
  return sounds.flatMap((sound) => donorPhones(sound, listed));
}

// -- Exports ------------------------------------------------------------------

export { isKnownSound, soundsToPhones };
export type { PhoneLanguage };
