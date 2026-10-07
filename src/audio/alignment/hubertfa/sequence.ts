import type { PhoneInterval } from "@/audio/alignment/hubertfa/decoder";
import { type Pronunciations, lookupWord } from "@/audio/alignment/hubertfa/lexicon";
import vocab from "@/audio/alignment/hubertfa/vocab-en.json";
import type { WordInterval } from "@/domain/alignment/words";

// -- Types --------------------------------------------------------------------

interface PhoneSequence {
  phoneIds: Int32Array;
  /** Word index for each sequence position, or -1 for the optional silences between words. */
  wordOf: Int32Array;
}

type SequenceResult =
  | { kind: "sequence"; sequence: PhoneSequence }
  | { kind: "unknown"; words: string[] }
  | { kind: "nothing-to-align" };

// -- Constants ----------------------------------------------------------------

const VOCAB: Record<string, number> = vocab.vocab;
const PHONE_PREFIX = vocab.language_prefix ? "en/" : "";
const SILENCE = "SP";

// -- Functions ----------------------------------------------------------------

// The forced sequence: SP, word 1's phones, SP, word 2's phones, ... SP. The
// decoder may skip any SP, so words can run together. Punctuation-only tokens
// contribute no phones.
function buildPhoneSequence(words: readonly string[], dictionary: Pronunciations): SequenceResult {
  const ids = [VOCAB[SILENCE]];
  const wordOf = [-1];
  const unknown: string[] = [];
  for (let w = 0; w < words.length; w++) {
    const lookup = lookupWord(words[w], dictionary);
    if (lookup.kind === "unknown") {
      unknown.push(lookup.key);
      continue;
    }
    if (lookup.kind === "silent") continue;
    for (const phone of lookup.phones) {
      const id = VOCAB[PHONE_PREFIX + phone];
      if (id === undefined) {
        unknown.push(lookup.phones.join(" "));
        break;
      }
      ids.push(id);
      wordOf.push(w);
    }
    ids.push(VOCAB[SILENCE]);
    wordOf.push(-1);
  }
  if (unknown.length > 0) return { kind: "unknown", words: [...new Set(unknown)] };
  if (ids.length === 1) return { kind: "nothing-to-align" };
  return { kind: "sequence", sequence: { phoneIds: Int32Array.from(ids), wordOf: Int32Array.from(wordOf) } };
}

// Word intervals from decoded phones. A word with no phones (punctuation)
// gets a zero-length slot where the previous word ended; the caller widens it.
function wordIntervalsFromPhones(
  phones: readonly PhoneInterval[],
  sequence: PhoneSequence,
  wordCount: number,
): WordInterval[] {
  const intervals: (WordInterval | null)[] = new Array(wordCount).fill(null);
  for (const phone of phones) {
    const w = sequence.wordOf[phone.index];
    if (w < 0) continue;
    const current = intervals[w];
    if (current) current.end = phone.end;
    else intervals[w] = { begin: phone.begin, end: phone.end };
  }
  let lastEnd = phones[0]?.begin ?? 0;
  return intervals.map((interval) => {
    if (interval) {
      lastEnd = interval.end;
      return interval;
    }
    return { begin: lastEnd, end: lastEnd };
  });
}

// -- Exports ------------------------------------------------------------------

export { buildPhoneSequence, wordIntervalsFromPhones };
