import type { PhoneInterval } from "@/audio/alignment/hubertfa/decoder";
import type { PhoneUnit } from "@/audio/alignment/hubertfa/g2p";
import vocab from "@/audio/alignment/hubertfa/vocab.json";
import type { WordInterval } from "@/domain/alignment/words";

// -- Types --------------------------------------------------------------------

interface PhoneSequence {
  phoneIds: Int32Array;
  /** Unit index for each sequence position, or -1 for the optional silences between units. */
  unitOf: Int32Array;
}

type SequenceResult =
  | { kind: "sequence"; sequence: PhoneSequence }
  | { kind: "unknown"; words: string[] }
  | { kind: "nothing-to-align" };

// -- Constants ----------------------------------------------------------------

const VOCAB: Record<string, number> = vocab.vocab;
const SILENCE_ID = VOCAB.SP;

// -- Functions ----------------------------------------------------------------

// Silence-class phones (the Japanese closure "cl", "SP", "AP") are shared
// across languages and have no prefix; everything else is "<language>/<phone>".
function phoneId(language: string, phone: string): number | undefined {
  return VOCAB[phone] ?? VOCAB[vocab.language_prefix ? `${language}/${phone}` : phone];
}

// The forced sequence: SP, unit 1's phones, SP, unit 2's phones, ... SP. The
// decoder may skip any SP. Two silences are never adjacent: a unit that starts
// or ends in a closure absorbs the SP beside it.
function buildPhoneSequence(units: readonly PhoneUnit[]): SequenceResult {
  const ids = [SILENCE_ID];
  const unitOf = [-1];
  const unknown: string[] = [];
  const push = (id: number, unit: number) => {
    const last = ids.length - 1;
    if (id === SILENCE_ID && ids[last] === SILENCE_ID) {
      if (unit >= 0) unitOf[last] = unit;
      return;
    }
    ids.push(id);
    unitOf.push(unit);
  };
  units.forEach((unit, u) => {
    if (unit.phones.length === 0) return;
    for (const { language, phone } of unit.phones) {
      const id = phoneId(language, phone);
      if (id === undefined) unknown.push(`${language}/${phone}`);
      else push(id, u);
    }
    push(SILENCE_ID, -1);
  });
  if (unknown.length > 0) return { kind: "unknown", words: [...new Set(unknown)] };
  if (!ids.some((id) => id !== SILENCE_ID)) return { kind: "nothing-to-align" };
  return { kind: "sequence", sequence: { phoneIds: Int32Array.from(ids), unitOf: Int32Array.from(unitOf) } };
}

// Unit intervals from decoded phones. A unit with no phones (punctuation)
// gets a zero-length slot where the previous one ended; the caller widens it.
function unitIntervalsFromPhones(
  phones: readonly PhoneInterval[],
  sequence: PhoneSequence,
  unitCount: number,
): WordInterval[] {
  const intervals: (WordInterval | null)[] = new Array(unitCount).fill(null);
  for (const phone of phones) {
    const u = sequence.unitOf[phone.index];
    if (u < 0) continue;
    const current = intervals[u];
    if (current) current.end = phone.end;
    else intervals[u] = { begin: phone.begin, end: phone.end };
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

// Spreads each unit's interval over the parts it covers by character count:
// syllables of an English word, or the characters of a kanji word.
function partIntervalsFromUnits(
  units: readonly PhoneUnit[],
  unitIntervals: readonly WordInterval[],
  parts: readonly string[],
): WordInterval[] {
  const out: WordInterval[] = new Array(parts.length);
  units.forEach((unit, u) => {
    const { begin, end } = unitIntervals[u];
    const total = unit.parts.reduce((sum, p) => sum + parts[p].length, 0) || 1;
    let at = begin;
    unit.parts.forEach((p, k) => {
      const next = k === unit.parts.length - 1 ? end : at + ((end - begin) * parts[p].length) / total;
      out[p] = { begin: at, end: next };
      at = next;
    });
  });
  return out;
}

// -- Exports ------------------------------------------------------------------

export { buildPhoneSequence, partIntervalsFromUnits, unitIntervalsFromPhones };
