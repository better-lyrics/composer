// @vitest-environment node
import { type G2pContext, type PhoneUnit, lineToPhoneUnits } from "@/audio/alignment/hubertfa/g2p";
import { kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { createJapaneseReader } from "@/audio/alignment/hubertfa/japanese-tokenizer";
import { LETTER_PHONES, guessPhones } from "@/audio/alignment/hubertfa/letter-to-sound";
import vocab from "@/audio/alignment/hubertfa/vocab.json";
import japaneseText from "@/audio/alignment/hubertfa/dictionary-ja.txt?raw";
import mandarinText from "@/audio/alignment/hubertfa/dictionary-zh.txt?raw";
import { parseDictionary } from "@/audio/alignment/hubertfa/lexicon";
import standIns from "@/audio/alignment/hubertfa/readers/ja-zh-to-en.json";
import { parsePhoneTable } from "@/audio/alignment/hubertfa/readers/phone-table";
import mfPhones from "@/audio/alignment/hubertfa/readers/test-fixtures/hubertfa_pt_mf_phones_v1.json";
import beforeReaders from "@/audio/alignment/hubertfa/test-fixtures/g2p-before-readers.json";
import { readFile } from "node:fs/promises";
import { pinyin } from "pinyin-pro";
import { beforeAll, describe, expect, it } from "vitest";

const english = parseDictionary(
  [
    "i\tay",
    "love\tl ah v",
    "you\ty uw",
    "dance\td ae n s",
    "ay\tay",
    "yeah\ty ae",
    "poser\tp ow z er",
    "mash\tm ae sh",
    "karat\tk eh r ax t",
  ].join("\n"),
);
const mandarin = parseDictionary(mandarinText);
const japanese = parseDictionary(japaneseText);
const pinyinOf = (text: string) => pinyin(text, { toneType: "none", type: "array", v: true });

let readJapanese: G2pContext["readJapanese"] = null;

beforeAll(async () => {
  const dir = "node_modules/@sglkc/kuromoji/dict";
  readJapanese = await createJapaneseReader(async (name) => {
    const file = await readFile(`${dir}/${name}`);
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  });
}, 60_000);

function context(hanReading: "zh" | "ja"): G2pContext {
  return {
    dictionaries: { en: english, zh: mandarin, ja: japanese },
    hanReading,
    pinyinOf,
    readJapanese,
    modelLanguages: ["en", "zh", "ja"],
  };
}

function phones(result: ReturnType<typeof lineToPhoneUnits>) {
  if (result.kind !== "units") throw new Error(`unknown: ${result.words}`);
  return result.units.map((u) => `${u.parts.join(",")}:${u.phones.map((p) => p.phone).join(" ")}`);
}

describe("kanaToMorae", () => {
  it("reads every kana the table knows as a key in the model's Japanese dictionary", () => {
    const kana =
      "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゔ" +
      "きゃきゅきょしゃしゅしょちゃちゅちょにゃにゅにょひゃひゅひょみゃみゅみょりゃりゅりょぎゃぎゅぎょじゃじゅじょびゃびゅびょぴゃぴゅぴょ" +
      "ファフィフェフォヴァヴィヴェヴォウィウェウォティディトゥドゥデュテュツァツェツォシェジェチェ";
    const morae = kanaToMorae(kana);
    expect(morae).not.toBeNull();
    expect(morae!.filter((m) => !japanese.has(m))).toEqual([]);
  });

  it("handles the closure, long vowels and n", () => {
    expect(kanaToMorae("きって")).toEqual(["ki", "cl", "te"]);
    expect(kanaToMorae("コーヒー")).toEqual(["ko", "o", "hi", "i"]);
    expect(kanaToMorae("さん")).toEqual(["sa", "n"]);
  });
});

describe("guessPhones", () => {
  it("only emits phones the model knows", () => {
    expect(LETTER_PHONES.filter((phone) => !(`en/${phone}` in vocab.vocab))).toEqual([]);
  });

  it("guesses a word from its spelling", () => {
    expect(guessPhones("yuh")).toEqual(["y", "ah"]);
    expect(guessPhones("ult")).toEqual(["ah", "l", "t"]);
  });
});

describe("lineToPhoneUnits", () => {
  it("gives each Chinese character its own unit, reading polyphones in context", () => {
    expect(phones(lineToPhoneUnits([["我", "去", "银", "行"]], context("zh")))).toEqual([
      "0:w uo",
      "1:q v",
      "2:y in",
      "3:h ang",
    ]);
  });

  it("maps interjections the dictionary lacks to the nearest syllable", () => {
    expect(lineToPhoneUnits([["嗯"]], context("zh")).kind).toBe("units");
  });

  it("reads kana as written, with particles as sung", () => {
    expect(phones(lineToPhoneUnits([["きょ", "う", "は"]], context("ja")))).toEqual(["0:ky o", "1:u", "2:w a"]);
  });

  it("reads a kanji word with the tokenizer and spans it over its characters", () => {
    const result = phones(lineToPhoneUnits([["君", "の", "名", "前"]], context("ja")));
    expect(result[0]).toBe("0:k i m i");
    expect(result[2]).toBe("2,3:n a m a e");
  });

  it("regression: reads every word inside one part that spans several of them", () => {
    expect(phones(lineToPhoneUnits([["君の名前"]], context("ja")))).toEqual(["0:k i m i n o n a m a e"]);
  });

  it("mixes English and Japanese in one line", () => {
    expect(phones(lineToPhoneUnits([["君", "と"], ["dance"]], context("ja")))).toEqual([
      "0:k i m i",
      "1:t o",
      "2:d ae n s",
    ]);
  });

  it("sings a kanji word's transliterated reading instead of the dictionary's", () => {
    const result = phones(
      lineToPhoneUnits([["運", "命", "の", "人"]], { ...context("ja"), transliteration: "sadame no hito" }),
    );
    expect(result).toEqual(["0,1:s a d a m e", "2:n o", "3:h i t o"]);
  });

  it("uses a whole-line romanization even when its per-part pairing was off", () => {
    // ENEMY (TWICE): the imported slots pair 完 with "ka" and 璧 with "n", but the line reads "kanpeki ja nakya".
    const result = phones(
      lineToPhoneUnits([["完", "璧", "じゃ", "な", "きゃ"], ["Ay-yeah"]], {
        ...context("ja"),
        transliteration: "ka n pe ki  ja  na kya  Ay-yeah",
      }),
    );
    expect(result[0]).toBe("0,1:k a N p e k i");
    expect(result.slice(1, 4)).toEqual(["2:j a", "3:n a", "4:ky a"]);
  });

  it("follows the transliteration where the dictionary can't read a character", () => {
    const result = phones(lineToPhoneUnits([["我", "去"]], { ...context("zh"), transliteration: "wǒ qù" }));
    expect(result).toEqual(["0:w uo", "1:q v"]);
  });

  it("regression: aligns a line around words the dictionary lacks, reading inflections from their stem", () => {
    const result = lineToPhoneUnits([["posers"], ["mashin'"], ["karats"], ["yuh"], ["love"]], context("zh"));
    expect(phones(result)).toEqual(["0:p ow z er z", "1:m ae sh ih n", "2:k eh r ax t s", "3:y ah", "4:l ah v"]);
    expect(result).toMatchObject({ guessed: ["yuh"] });
  });

  it("reads English, Mandarin and Japanese as before the language readers, through English stand-ins on a model without them", () => {
    // Captured from lineToPhoneUnits before the readers existed, on the built-in model.
    const standIn = (unit: PhoneUnit, modelLanguages: readonly string[]): PhoneUnit => {
      const language = unit.phones.find((p) => p.language !== "en")?.language;
      if (!language || language === "en" || modelLanguages.includes(language)) return unit;
      const table: Record<string, { en: string[] }> = standIns[language];
      const phones = unit.phones.flatMap((p) =>
        table[p.phone] ? table[p.phone].en.map((phone) => ({ language: "en" as const, phone })) : [p],
      );
      return { ...unit, phones, reader: language };
    };
    for (const modelLanguages of [["en", "zh", "ja"], ["en", "ja"], ["en"]]) {
      for (const { words, hanReading, transliteration, expected } of beforeReaders) {
        const reading = hanReading === "ja" ? "ja" : "zh";
        const ctx = { ...context(reading), transliteration: transliteration ?? null, latinReader: null, modelLanguages };
        const units = (expected.units ?? []).map((unit) => standIn(unit as PhoneUnit, modelLanguages));
        const result = lineToPhoneUnits(words, ctx);
        expect(result).toEqual(expected.kind === "units" ? { ...expected, units } : expected);
        const left = result.kind === "units" ? result.units.flatMap((unit) => unit.phones) : [];
        const foreign = left.filter((p) => p.phone !== "cl" && !modelLanguages.includes(p.language));
        expect(foreign).toEqual([]);
      }
    }
  });

  it("reads Hangul blocks and the project's Latin language with their readers, and Latin words in a Korean song as English", () => {
    const korean = lineToPhoneUnits([["사", "랑", "해"], ["love"]], { ...context("zh"), modelLanguages: ["en"] });
    expect(phones(korean)).toEqual(["0:s aa", "1:dx aa ng", "2:eh", "3:l ah v"]);
    const spanish = lineToPhoneUnits([["que"], ["hijo"]], {
      ...context("zh"),
      latinReader: "es",
      modelLanguages: ["en"],
    });
    expect(phones(spanish)).toEqual(["0:k eh", "1:iy hh ow"]);
  });

  it("reads every language but English through a model's phone table, leaving the closure out", () => {
    const phoneTable = parsePhoneTable(mfPhones);
    const keys = (result: ReturnType<typeof lineToPhoneUnits>) =>
      result.kind === "units" ? result.units.map((u) => u.phones.map((p) => `${p.language}/${p.phone}`).join(" ")) : [];
    const japanese = lineToPhoneUnits([["きっ", "と"], ["love"]], { ...context("ja"), phoneTable });
    expect(keys(japanese)).toEqual(["en/k en/iy", "en/t en/_o", "en/l en/ah en/v"]);
    const spanish = lineToPhoneUnits([["no"]], { ...context("zh"), latinReader: "es", phoneTable });
    expect(keys(spanish)).toEqual(["en/n en/_o"]);
  });

  it("reports words in scripts no reader covers", () => {
    expect(lineToPhoneUnits([["รัก"]], context("zh"))).toEqual({ kind: "unknown", words: ["รัก"] });
  });
});
