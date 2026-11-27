import standIns from "@/audio/alignment/hubertfa/readers/ja-zh-to-en.json";
import table from "@/audio/alignment/hubertfa/readers/phone-donors.json";
import { isKnownSound, soundsToPhones } from "@/audio/alignment/hubertfa/readers/donors";
import { type ReaderLanguage, readWord } from "@/audio/alignment/hubertfa/readers/reader-units";
import fixtures from "@/audio/alignment/hubertfa/readers/test-fixtures/reader-words.json";
import vocab from "@/audio/alignment/hubertfa/vocab.json";
import { describe, expect, it } from "vitest";

const readers = fixtures.readers as Record<ReaderLanguage, Record<string, string>>;

describe("language readers", () => {
  it("read every fixture word as expected", () => {
    const wrong = Object.entries(readers).flatMap(([reader, words]) =>
      Object.entries(words).flatMap(([word, expected]) => {
        const got = readWord(reader as ReaderLanguage, word).sounds.join(" ");
        return got === expected ? [] : [`${reader} ${word}: expected "${expected}", got "${got}"`];
      }),
    );
    expect(wrong).toEqual([]);
  });

  it("emit only sounds the donor table has", () => {
    const missing = Object.entries(readers).flatMap(([reader, words]) =>
      Object.keys(words).flatMap((word) =>
        readWord(reader as ReaderLanguage, word)
          .sounds.filter((sound) => !isKnownSound(sound))
          .map((sound) => `${reader} ${word}: ${sound}`),
      ),
    );
    expect(missing).toEqual([]);
  });
});

describe("phone donors", () => {
  it("name only phones the model vocabulary has, and end every sound on English", () => {
    const ids: Record<string, number> = vocab.vocab;
    const problems = Object.entries(table.sounds).flatMap(([sound, candidates]) => [
      ...candidates.flatMap(([language, phones]) =>
        (phones as string[]).filter((phone) => ids[phone] === undefined && ids[`${language}/${phone}`] === undefined),
      ),
      ...(candidates[candidates.length - 1][0] === "en" ? [] : [`${sound} does not end on English`]),
    ]);
    expect(problems).toEqual([]);
  });

  it("give every Mandarin and Japanese vocabulary phone English stand-ins the vocabulary has", () => {
    const ids: Record<string, number> = vocab.vocab;
    const problems = (["zh", "ja"] as const).flatMap((language) => {
      const table: Record<string, { en: string[] }> = standIns[language];
      const phones = Object.keys(ids).filter((key) => key.startsWith(`${language}/`));
      return [
        ...phones.filter((key) => !table[key.slice(language.length + 1)]).map((key) => `${key} has no stand-in`),
        ...Object.entries(table).flatMap(([phone, { en }]) =>
          en.filter((stand) => ids[`en/${stand}`] === undefined).map((stand) => `${language}/${phone}: en/${stand}`),
        ),
      ];
    });
    expect(problems).toEqual([]);
  });

  it("take the first candidate the loaded model has", () => {
    expect(soundsToPhones(["ɲ"], ["en"])).toEqual([
      { language: "en", phone: "n" },
      { language: "en", phone: "y" },
    ]);
    expect(soundsToPhones(["ɲ"], ["en", "zh", "ja"])).toEqual([{ language: "ja", phone: "ny" }]);
  });
});
