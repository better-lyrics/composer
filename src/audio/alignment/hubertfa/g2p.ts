import { type ReadingToken, isKana, kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { type Pronunciations, lookupWord } from "@/audio/alignment/hubertfa/lexicon";
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
}

type G2pResult = { kind: "units"; units: PhoneUnit[] } | { kind: "unknown"; words: string[] };

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

function lookupMorae(morae: string[], dictionary: Pronunciations): string[] | null {
  const phones: string[] = [];
  for (const mora of morae) {
    const hit = dictionary.get(mora);
    if (!hit) return null;
    phones.push(...hit);
  }
  return phones;
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

/**
 * Phones for one line. English words are looked up whole; each Chinese
 * character and each Japanese kana part is its own unit, so they get their
 * own timing; a kanji word is one unit across its characters, since its
 * reading can't be split between them.
 */
function lineToPhoneUnits(words: readonly string[][], context: G2pContext): G2pResult {
  const { parts, text } = layout(words);
  const unknown = new Set<string>();
  const units: PhoneUnit[] = [];
  const pinyin = context.hanReading === "zh" && context.pinyinOf ? context.pinyinOf(text) : null;
  const kanjiGroups = context.hanReading === "ja" ? japaneseReadings(text, context.readJapanese) : [];

  let i = 0;
  while (i < parts.length) {
    const part = parts[i];

    // A non-CJK word (possibly split into syllables): one English unit.
    if (!hasCjk(part.text)) {
      const indices = [i];
      while (i + 1 < parts.length && parts[i + 1].word === part.word && !hasCjk(parts[i + 1].text)) {
        indices.push(++i);
      }
      i++;
      const word = indices.map((p) => parts[p].text).join("");
      if (hasLetterOrDigit(word) && !LATIN_OR_DIGIT.test(word)) {
        unknown.add(word.trim());
        continue;
      }
      const lookup = lookupWord(word, context.dictionaries.en);
      if (lookup.kind === "unknown") unknown.add(lookup.key);
      const phones = lookup.kind === "phones" ? lookup.phones.map((phone) => ({ language: "en" as const, phone })) : [];
      units.push({ parts: indices, phones });
      continue;
    }

    // Mandarin: one pinyin syllable per Han character.
    if (context.hanReading === "zh" && hasHan(part.text)) {
      const phones: PhoneUnit["phones"] = [];
      for (let c = 0; c < part.text.length; c++) {
        if (!hasHan(part.text[c])) continue;
        const syllable = pinyin?.[part.start + c];
        const hit = syllable
          ? (context.dictionaries.zh.get(syllable) ?? context.dictionaries.zh.get(PINYIN_FALLBACKS[syllable] ?? ""))
          : undefined;
        if (!hit) unknown.add(part.text[c]);
        else phones.push(...hit.map((phone) => ({ language: "zh" as const, phone })));
      }
      units.push({ parts: [i++], phones });
      continue;
    }

    // Japanese: a kanji word spans every part it touches.
    const group = kanjiGroups.find((g) => part.start < g.end && part.start + part.text.length > g.start);
    if (group) {
      const indices = [i];
      while (i + 1 < parts.length && parts[i + 1].start < group.end) indices.push(++i);
      i++;
      const morae = kanaToMorae(group.kana);
      const phones = morae ? lookupMorae(morae, context.dictionaries.ja) : null;
      if (!phones) unknown.add(group.kana);
      units.push({ parts: indices, phones: (phones ?? []).map((phone) => ({ language: "ja" as const, phone })) });
      continue;
    }

    const kana = [...part.text].filter((c) => isKana(c)).join("");
    const morae = kana ? kanaToMorae(kana) : null;
    const phones = morae ? lookupMorae(morae, context.dictionaries.ja) : null;
    if (!phones) unknown.add(part.text.trim());
    units.push({ parts: [i++], phones: (phones ?? []).map((phone) => ({ language: "ja" as const, phone })) });
  }

  if (unknown.size > 0) return { kind: "unknown", words: [...unknown] };
  return { kind: "units", units };
}

// -- Exports ------------------------------------------------------------------

export { lineToPhoneUnits };
export type { G2pContext, HanReading, PhoneUnit };
