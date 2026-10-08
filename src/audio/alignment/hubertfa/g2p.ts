import { type ReadingToken, isKana, kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { type Pronunciations, lookupWord } from "@/audio/alignment/hubertfa/lexicon";
import { pinyinSyllables, plainWords, romajiLine } from "@/audio/alignment/hubertfa/romanization";
import { hasCjk, hasHan, hasLetterOrDigit } from "@/domain/alignment/cjk";

// -- Types --------------------------------------------------------------------

type Language = "en" | "zh" | "ja";

/** How Han characters are read: as Mandarin, or as Japanese kanji. */
type HanReading = "zh" | "ja";

/** A stretch of the line timed as one block of phones, covering one or more parts. */
interface PhoneUnit {
  /** Indices into the line's flattened parts. */
  parts: number[];
  /** Phones as dictionary entries, each tagged with its language. */
  phones: { language: Language; phone: string }[];
}

interface G2pContext {
  dictionaries: Record<Language, Pronunciations>;
  hanReading: HanReading;
  /** Per-character toneless pinyin, null for anything that isn't Han. */
  pinyinOf: ((text: string) => (string | null)[]) | null;
  readJapanese: ((text: string) => ReadingToken[]) | null;
  /** The line's romanization, when it differs from the line itself. Its syllables are what's sung. */
  transliteration?: string | null;
}

type G2pResult = { kind: "units"; units: PhoneUnit[] } | { kind: "unknown"; words: string[] };

/**
 * A unit before its phones are looked up. Mandarin and Japanese readings are
 * syllable/mora keys, which a transliteration can replace; null means the
 * reading is still unknown.
 */
interface ReadingUnit {
  parts: number[];
  language: Language;
  /** The text as written: an English word, or the CJK characters. */
  text: string;
  reading: string[] | null;
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
      units.push({ parts: indices, language: "en", text: partsText(indices), reading: null });
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
    const group = kanjiGroups.find((g) => part.start < g.end && part.start + part.text.length > g.start);
    if (group) {
      const indices = [i];
      while (i + 1 < parts.length && parts[i + 1].start < group.end) indices.push(++i);
      i++;
      units.push({ parts: indices, language: "ja", text: partsText(indices), reading: kanaToMorae(group.kana) });
      continue;
    }
    const kana = [...part.text].filter((c) => isKana(c)).join("");
    units.push({ parts: [i], language: "ja", text: part.text, reading: kana ? kanaToMorae(kana) : null });
    i++;
  }
  return units;
}

/**
 * The transliteration says what's sung; the dictionaries only say which
 * characters sing it. Line the transliteration's syllables up with the
 * dictionary readings (an edit-distance alignment, with English words as
 * anchors) and give each Chinese/Japanese unit the syllables that landed on
 * it. Where they agree nothing changes; where they differ (運命 sung as
 * "sadame", a kanji the tokenizer couldn't read) the transliteration wins.
 * Per-part transliterations aren't trusted on their own: imported lyrics
 * often pair them with the wrong characters, while the line as a whole reads
 * correctly.
 */
function applyLineTransliteration(
  units: ReadingUnit[],
  text: string,
  hanReading: HanReading,
  isMora: (key: string) => boolean,
) {
  const english = new Set(units.filter((u) => u.language === "en").flatMap((u) => plainWords(u.text)));
  const target: string[] = [];
  const words =
    hanReading === "zh" ? pinyinSyllables(text).map((word) => ({ word, morae: [word] })) : romajiLine(text, isMora);
  for (const { word, morae } of words) {
    const plain = word.replaceAll("'", "");
    if (english.has(plain)) target.push(`en:${plain}`);
    else if (morae) target.push(...morae);
  }
  const source: { token: string; unit: number }[] = [];
  units.forEach((unit, u) => {
    if (unit.language === "en") {
      for (const token of plainWords(unit.text)) source.push({ token: `en:${token}`, unit: u });
    } else if (unit.reading) {
      for (const token of unit.reading) source.push({ token, unit: u });
    } else {
      // Unknown reading: one placeholder, so the alignment hands it whatever is opposite.
      source.push({ token: "\u0000", unit: u });
    }
  });
  if (target.length === 0 || source.length === 0) return;

  // Edit-distance table, then walk back assigning each target token to a unit.
  const n = source.length;
  const m = target.length;
  const cost = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = source[i - 1].token === target[j - 1] ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + same, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const assigned: string[][] = units.map(() => []);
  let i = n;
  let j = m;
  while (j > 0) {
    if (i > 0 && cost[i][j] === cost[i - 1][j - 1] + (source[i - 1].token === target[j - 1] ? 0 : 1)) {
      assigned[source[i - 1].unit].unshift(target[j - 1]);
      i--;
      j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      i--;
    } else {
      // Extra transliteration syllable: it belongs to the unit before (or the first).
      assigned[source[Math.max(0, i - 1)].unit].unshift(target[j - 1]);
      j--;
    }
  }
  units.forEach((unit, u) => {
    const reading = assigned[u].filter((t) => !t.startsWith("en:"));
    if (unit.language !== "en" && reading.length > 0) unit.reading = reading;
  });
}

function lookupPhones(unit: ReadingUnit, dictionaries: G2pContext["dictionaries"]): string[] | null {
  if (unit.language === "en") {
    const lookup = lookupWord(unit.text, dictionaries.en);
    if (lookup.kind === "unknown") return null;
    return lookup.kind === "phones" ? lookup.phones : [];
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
  const phoneUnits: PhoneUnit[] = [];
  for (const unit of units) {
    if (unit.language === "en" && hasLetterOrDigit(unit.text) && !LATIN_OR_DIGIT.test(unit.text)) {
      unknown.add(unit.text.trim());
      continue;
    }
    const phones = lookupPhones(unit, context.dictionaries);
    if (!phones) {
      unknown.add(
        unit.language === "en"
          ? ((lookupWord(unit.text, context.dictionaries.en) as { key?: string }).key ?? unit.text)
          : unit.text.trim(),
      );
      continue;
    }
    phoneUnits.push({ parts: unit.parts, phones: phones.map((phone) => ({ language: unit.language, phone })) });
  }
  if (unknown.size > 0) return { kind: "unknown", words: [...unknown] };
  return { kind: "units", units: phoneUnits };
}

// -- Exports ------------------------------------------------------------------

export { lineToPhoneUnits };
export type { G2pContext, HanReading, PhoneUnit };
