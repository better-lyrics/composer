// @vitest-environment node
import { type G2pContext, lineToPhoneUnits } from "@/audio/alignment/hubertfa/g2p";
import { kanaToMorae } from "@/audio/alignment/hubertfa/japanese";
import { createJapaneseReader } from "@/audio/alignment/hubertfa/japanese-tokenizer";
import japaneseText from "@/audio/alignment/hubertfa/dictionary-ja.txt?raw";
import mandarinText from "@/audio/alignment/hubertfa/dictionary-zh.txt?raw";
import { parseDictionary } from "@/audio/alignment/hubertfa/lexicon";
import { readFile } from "node:fs/promises";
import { pinyin } from "pinyin-pro";
import { beforeAll, describe, expect, it } from "vitest";

const english = parseDictionary(["i\tay", "love\tl ah v", "you\ty uw", "dance\td ae n s"].join("\n"));
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
  return { dictionaries: { en: english, zh: mandarin, ja: japanese }, hanReading, pinyinOf, readJapanese };
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

  it("mixes English and Japanese in one line", () => {
    expect(phones(lineToPhoneUnits([["君", "と"], ["dance"]], context("ja")))).toEqual([
      "0:k i m i",
      "1:t o",
      "2:d ae n s",
    ]);
  });

  it("reports words in scripts the model doesn't cover", () => {
    expect(lineToPhoneUnits([["사랑해"]], context("zh"))).toEqual({ kind: "unknown", words: ["사랑해"] });
  });
});
