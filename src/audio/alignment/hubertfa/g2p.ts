import { type ReadingToken, isKana, kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { type Pronunciations, lookupWord } from "@/audio/alignment/hubertfa/lexicon";
import { numberUnit } from "@/audio/alignment/hubertfa/numbers/number-unit";
import { type PhoneLanguage, soundsToPhones, standInPhones } from "@/audio/alignment/hubertfa/readers/donors";
import {
  type PhoneTable,
  tableDictionaryPhones,
  tableSoundPhones,
} from "@/audio/alignment/hubertfa/readers/phone-table";
import { type ReaderLanguage, type ReaderUnit, segmentWord } from "@/audio/alignment/hubertfa/readers/reader-units";
import { applyLineTransliteration } from "@/audio/alignment/hubertfa/transliteration-readings";
import { hasCjk, hasHan, hasLetterOrDigit } from "@/domain/alignment/cjk";
import type { HanReading, LatinReader } from "@/domain/alignment/language";

// -- Types --------------------------------------------------------------------

type Language = PhoneLanguage;

/** A stretch of the line timed as one block of phones, covering one or more parts. */
interface PhoneUnit {
  /** Indices into the line's flattened parts. */
  parts: number[];
  /** Phones as dictionary entries, each tagged with its language. */
  phones: { language: Language; phone: string }[];
  /** True when the pronunciation was guessed from spelling. */
  guessed?: boolean;
  /**
   * The language that read the unit when its phones don't say: a language
   * reader, or Mandarin or Japanese read with English stand-ins or a model's
   * phone table. Absent for English, and for Mandarin and Japanese phones.
   */
  reader?: ReaderLanguage | "zh" | "ja";
  /** A language reader's sounds. */
  sounds?: string[];
}

interface G2pContext {
  dictionaries: Record<Language, Pronunciations>;
  hanReading: HanReading;
  /** Per-character toneless pinyin, null for anything that isn't Han. */
  pinyinOf: ((text: string) => (string | null)[]) | null;
  readJapanese: ((text: string) => ReadingToken[]) | null;
  /** The line's romanization, when it differs from the line itself. Its syllables are what's sung. */
  transliteration?: string | null;
  /** The reader for Latin-script words; none reads them as English. */
  latinReader?: LatinReader | null;
  /**
   * The loaded model's manifest languages, which pick the phones a reader's
   * sounds become, and whether Mandarin and Japanese keep their own phones.
   */
  modelLanguages: readonly string[];
  /** The loaded model's own phones for every language but English, when its manifest names a table. */
  phoneTable?: PhoneTable | null;
}

/** `guessed` lists words read from their spelling, whose timing is worth a check. */
type G2pResult = { kind: "units"; units: PhoneUnit[]; guessed: string[] } | { kind: "unknown"; words: string[] };

/**
 * A unit before its phones are looked up. Mandarin and Japanese readings are
 * syllable/mora keys, which a transliteration can replace; null means the
 * reading is still unknown.
 */
interface ReadingUnit {
  parts: number[];
  /** "reader" for a unit a language reader read, whose sounds are in `read`. */
  language: Language | "reader";
  /** The text as written: an English word, or the CJK characters. */
  text: string;
  reading: string[] | null;
  read?: ReaderUnit;
  /** A written number's words, which are read in place of its digits. */
  spoken?: string;
}

// -- Constants ----------------------------------------------------------------

const LATIN_OR_DIGIT = /[\p{Script=Latin}\p{N}]/u;
// Interjection readings the Mandarin dictionary has no syllable for (嗯, 呣).
const PINYIN_FALLBACKS: Record<string, string> = { ng: "en", n: "en", m: "mu", hm: "hen", hng: "heng" };

// -- Functions ----------------------------------------------------------------

// Char offset of each part within the line text, and which word it belongs to.
function layout(words: readonly string[][]) {
  const parts: { text: string; word: number; start: number }[] = [];
  let offset = 0;
  words.forEach((word, w) => {
    for (const text of word) {
      parts.push({ text, word: w, start: offset });
      offset += text.length;
    }
  });
  return { parts, text: parts.map((p) => p.text).join("") };
}

// Japanese reading of each character offset: kana read as written (the
// tokenizer's pronunciation fixes particles like は → wa), and a kanji word's
// reading attached to the whole word as one group.
function japaneseReadings(text: string, readJapanese: G2pContext["readJapanese"]) {
  const groups: { start: number; end: number; kana: string }[] = [];
  for (const token of readJapanese?.(text) ?? []) {
    const end = token.start + token.surface.length;
    if (hasHan(token.surface)) {
      if (token.pronunciation) groups.push({ start: token.start, end, kana: token.pronunciation });
    } else if (token.surface.length === 1 && token.pronunciation && isKana(token.surface)) {
      groups.push({ start: token.start, end, kana: token.pronunciation });
    }
  }
  return groups;
}

type ReadingGroup = ReturnType<typeof japaneseReadings>[number];

// Where a unit must end to keep every reading group it touches whole, or null when it touches none.
function groupsEnd(groups: readonly ReadingGroup[], start: number, end: number): number | null {
  const touched = groups.filter((g) => start < g.end && end > g.start);
  return touched.length > 0 ? Math.max(end, ...touched.map((g) => g.end)) : null;
}

// The kana sung across a span: each reading group as the tokenizer reads it, other kana as written.
// Null when a kanji in the span has no reading.
function spanKana(text: string, start: number, end: number, groups: readonly ReadingGroup[]): string | null {
  let kana = "";
  let k = start;
  while (k < end) {
    const group = groups.find((g) => g.start <= k && k < g.end);
    if (group) {
      kana += group.kana;
      k = group.end;
      continue;
    }
    if (hasHan(text[k])) return null;
    if (isKana(text[k])) kana += text[k];
    k++;
  }
  return kana;
}

// Units and their dictionary readings. English words are units of their own;
// each Chinese character and each Japanese kana part is its own unit so it
// gets its own timing; a kanji word is one unit across its characters, since
// its reading can't be split between them.
function readingUnits(words: readonly string[][], context: G2pContext): ReadingUnit[] {
  const { parts, text } = layout(words);
  const units: ReadingUnit[] = [];
  const pinyin = context.hanReading === "zh" && context.pinyinOf ? context.pinyinOf(text) : null;
  const kanjiGroups = context.hanReading === "ja" ? japaneseReadings(text, context.readJapanese) : [];
  const partsText = (indices: number[]) => indices.map((p) => parts[p].text).join("");

  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (!hasCjk(part.text)) {
      const indices = [i];
      while (i + 1 < parts.length && parts[i + 1].word === part.word && !hasCjk(parts[i + 1].text)) {
        indices.push(++i);
      }
      i++;
      const word = indices.map((index) => ({ index, text: parts[index].text }));
      for (const segment of segmentWord(word, context.latinReader ?? null)) {
        if (segment.kind === "english") {
          const unit: ReadingUnit = {
            parts: segment.parts,
            language: "en",
            text: partsText(segment.parts),
            reading: null,
          };
          units.push(numberUnit(unit, parts, context) ?? unit);
        } else {
          for (const read of segment.units) {
            units.push({ parts: read.parts, language: "reader", text: partsText(read.parts), reading: null, read });
          }
        }
      }
      continue;
    }
    if (context.hanReading === "zh" && hasHan(part.text)) {
      const syllables = [...part.text]
        .map((c, k) => (hasHan(c) ? (pinyin?.[part.start + k] ?? null) : ""))
        .filter((s) => s !== "");
      const reading = syllables.every((s) => s !== null) ? (syllables as string[]) : null;
      units.push({ parts: [i], language: "zh", text: part.text, reading });
      i++;
      continue;
    }
    let end = groupsEnd(kanjiGroups, part.start, part.start + part.text.length);
    if (end !== null) {
      const indices = [i];
      while (i + 1 < parts.length && parts[i + 1].start < end) {
        const next = parts[++i];
        indices.push(i);
        end = groupsEnd(kanjiGroups, next.start, Math.max(end, next.start + next.text.length)) ?? end;
      }
      i++;
      const kana = spanKana(text, part.start, end, kanjiGroups);
      units.push({
        parts: indices,
        language: "ja",
        text: partsText(indices),
        reading: kana ? kanaToMorae(kana) : null,
      });
      continue;
    }
    const kana = [...part.text].filter((c) => isKana(c)).join("");
    units.push({ parts: [i], language: "ja", text: part.text, reading: kana ? kanaToMorae(kana) : null });
    i++;
  }
  return units;
}

function lookupPhones(unit: ReadingUnit, dictionaries: G2pContext["dictionaries"], guessed: Set<string>) {
  if (unit.language === "en") {
    const lookup = lookupWord(unit.spoken ?? unit.text, dictionaries.en);
    if (lookup.kind === "unknown") return null;
    if (lookup.kind === "guessed") guessed.add(lookup.key);
    return lookup.kind === "silent" ? [] : lookup.phones;
  }
  if (!unit.reading) return null;
  const phones: string[] = [];
  for (const key of unit.reading) {
    const hit =
      unit.language === "zh"
        ? (dictionaries.zh.get(key) ?? dictionaries.zh.get(PINYIN_FALLBACKS[key] ?? ""))
        : dictionaries.ja.get(key);
    if (!hit) return null;
    phones.push(...hit);
  }
  return phones;
}

/** Phones for one line, preferring the line's transliteration for Chinese and Japanese readings. */
function lineToPhoneUnits(words: readonly string[][], context: G2pContext): G2pResult {
  const units = readingUnits(words, context);
  const isMora = (key: string) => key !== "cl" && context.dictionaries.ja.has(key);
  if (context.transliteration) applyLineTransliteration(units, context.transliteration, context.hanReading, isMora);

  const unknown = new Set<string>();
  const guessed = new Set<string>();
  const phoneUnits: PhoneUnit[] = [];
  const listed = new Set(context.modelLanguages);
  for (const unit of units) {
    if (unit.language === "reader") {
      if (!unit.read) continue;
      const { reader, sounds, guessed: wasGuessed } = unit.read;
      if (wasGuessed) guessed.add(unit.text.trim());
      const table = context.phoneTable;
      const phones = table ? tableSoundPhones(table, sounds) : soundsToPhones(sounds, context.modelLanguages);
      phoneUnits.push({ parts: unit.parts, phones, guessed: wasGuessed, reader, sounds });
      continue;
    }
    if (unit.language === "en" && hasLetterOrDigit(unit.text) && !LATIN_OR_DIGIT.test(unit.text)) {
      unknown.add(unit.text.trim());
      continue;
    }
    const phones = lookupPhones(unit, context.dictionaries, guessed);
    if (!phones) {
      unknown.add(
        unit.language === "en"
          ? ((lookupWord(unit.text, context.dictionaries.en) as { key?: string }).key ?? unit.text)
          : unit.text.trim(),
      );
      continue;
    }
    const { language } = unit;
    // Which reading of a number was sung is a guess, so its word is reported with the guessed ones.
    if (unit.spoken !== undefined) guessed.add(unit.text.trim());
    const wasGuessed =
      unit.spoken !== undefined ||
      (language === "en" && lookupWord(unit.text, context.dictionaries.en).kind === "guessed");
    if (language !== "en" && (context.phoneTable || !listed.has(language))) {
      const borrowed = context.phoneTable
        ? tableDictionaryPhones(context.phoneTable, language, phones)
        : standInPhones(language, phones);
      phoneUnits.push({ parts: unit.parts, phones: borrowed, guessed: false, reader: language });
      continue;
    }
    phoneUnits.push({ parts: unit.parts, phones: phones.map((phone) => ({ language, phone })), guessed: wasGuessed });
  }
  if (unknown.size > 0) return { kind: "unknown", words: [...unknown] };
  return { kind: "units", units: phoneUnits, guessed: [...guessed] };
}

// -- Exports ------------------------------------------------------------------

export { lineToPhoneUnits };
export type { G2pContext, PhoneUnit, ReadingUnit };
