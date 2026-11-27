import { type ModelPhone, type PhoneLanguage, soundsToPhones, standInPhones } from "@/audio/alignment/hubertfa/readers/donors";
import vocab from "@/audio/alignment/hubertfa/vocab.json";

// A model trained on phones of its own for every language names a phone table
// in its manifest. The table gives each reader sound and each Mandarin and
// Japanese phone as that model's phones: English ones where English has the
// sound, and a few keys of its own ("en/_o") that reuse the output row of a
// phone the model no longer trains ("ja/o"). Such a model is never given the
// donor or stand-in phones, nor a Mandarin or Japanese phone as it is.

// -- Types --------------------------------------------------------------------

interface PhoneTable {
  /** The bundled vocabulary key whose output row each of the table's own keys uses: "en/_o" -> "ja/o". */
  rows: ReadonlyMap<string, string>;
  sounds: ReadonlyMap<string, readonly ModelPhone[]>;
  zh: ReadonlyMap<string, readonly ModelPhone[]>;
  ja: ReadonlyMap<string, readonly ModelPhone[]>;
}

// -- Constants ----------------------------------------------------------------

const VOCAB: Record<string, number> = vocab.vocab;
const PHONE_LANGUAGES = new Set<string>(["en", "zh", "ja"]);
// Chinese spells a glide twice (wo is w + uo, ye is y + ie); the model hears it once.
const GLIDES = new Set(["w", "y"]);

// -- Functions ----------------------------------------------------------------

function asRecord(raw: unknown, what: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Phone table: ${what} isn't an object`);
  return raw as Record<string, unknown>;
}

function parseKey(key: unknown, rows: ReadonlyMap<string, string>): ModelPhone {
  if (typeof key !== "string") throw new Error(`Phone table: ${JSON.stringify(key)} isn't a phone key`);
  const slash = key.indexOf("/");
  const language = key.slice(0, slash);
  if (slash < 0 || !PHONE_LANGUAGES.has(language) || (VOCAB[key] === undefined && !rows.has(key))) {
    throw new Error(`Phone table: ${key} is neither a vocabulary key nor one of the table's own`);
  }
  return { language: language as PhoneLanguage, phone: key.slice(slash + 1) };
}

function parseLists(raw: unknown, what: string, rows: ReadonlyMap<string, string>) {
  return new Map(
    Object.entries(asRecord(raw, what)).map(([name, keys]): [string, ModelPhone[]] => {
      if (!Array.isArray(keys)) throw new Error(`Phone table: ${what}.${name} isn't a list`);
      return [name, keys.map((key) => parseKey(key, rows))];
    }),
  );
}

/** A model's phone table, checked against the bundled vocabulary. Throws on anything it can't use. */
function parsePhoneTable(raw: unknown): PhoneTable {
  const table = asRecord(raw, "the table");
  const rows = new Map(
    Object.entries(asRecord(table.phones, "phones")).map(([key, entry]): [string, string] => {
      const { row } = asRecord(entry, `phones.${key}`);
      if (VOCAB[key] !== undefined || typeof row !== "string" || VOCAB[row] === undefined) {
        throw new Error(`Phone table: ${key} must be a new key on a vocabulary row`);
      }
      return [key, row];
    }),
  );
  return {
    rows,
    sounds: parseLists(table.sounds, "sounds", rows),
    zh: parseLists(table.zh, "zh", rows),
    ja: parseLists(table.ja, "ja", rows),
  };
}

/** A reader's sounds as the table's phones. A sound the table lacks takes its English donor phones. */
function tableSoundPhones(table: PhoneTable, sounds: readonly string[]): ModelPhone[] {
  return sounds.flatMap((sound) => table.sounds.get(sound) ?? soundsToPhones([sound], ["en"]));
}

/**
 * A Mandarin or Japanese reading as the table's phones, in order. A repeated
 * glide is dropped, and silence keys like the closure `cl` are left out. A
 * phone the table lacks takes its English stand-ins.
 */
function tableDictionaryPhones(table: PhoneTable, language: "zh" | "ja", phones: readonly string[]): ModelPhone[] {
  const out: (ModelPhone | null)[] = [];
  for (const phone of phones) {
    if (VOCAB[phone] !== undefined) {
      out.push(null);
      continue;
    }
    const mapped = table[language].get(phone) ?? standInPhones(language, [phone]);
    const [first] = mapped;
    const previous = out[out.length - 1];
    const repeated =
      first?.language === "en" && GLIDES.has(first.phone) && previous?.language === "en" && previous.phone === first.phone;
    out.push(...(repeated ? mapped.slice(1) : mapped));
  }
  return out.filter((phone): phone is ModelPhone => phone !== null);
}

// -- Exports ------------------------------------------------------------------

export { parsePhoneTable, tableDictionaryPhones, tableSoundPhones };
export type { PhoneTable };
