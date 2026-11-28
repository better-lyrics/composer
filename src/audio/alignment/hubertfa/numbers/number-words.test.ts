// @vitest-environment node
import { type NumberLanguage, numberWords } from "@/audio/alignment/hubertfa/numbers/number-words";
import { describe, expect, it } from "vitest";

const said = (text: string, language: NumberLanguage, after = "") => numberWords(text, language, after)?.join(" ");

describe("numberWords", () => {
  it("says English numbers as lyrics do: years in pairs, ordinals, decades, and digits read out", () => {
    const expected: Record<string, string> = {
      "0": "zero",
      "17": "seventeen",
      "21": "twenty one",
      "100": "one hundred",
      "101": "one hundred one",
      "1,000": "one thousand",
      "12345": "twelve thousand three hundred forty five",
      "1999": "nineteen ninety nine",
      "1905": "nineteen oh five",
      "1900": "nineteen hundred",
      "2005": "two thousand five",
      "2020": "twenty twenty",
      "1st": "first",
      "22nd": "twenty second",
      "30th": "thirtieth",
      "90s": "nineties",
      "1980's": "nineteen eighties",
      "24/7": "twenty four seven",
      "4ever": "four ever",
      "007": "oh oh seven",
      "8675309": "eight six seven five three oh nine",
    };
    for (const [text, words] of Object.entries(expected)) expect(said(text, "en"), text).toBe(words);
  });

  it("says a number in each language a reader reads", () => {
    const expected: [NumberLanguage, string, string][] = [
      ["es", "17", "diecisiete"],
      ["es", "31", "treinta y uno"],
      ["es", "100", "cien"],
      ["es", "1999", "mil novecientos noventa y nueve"],
      ["pt", "17", "dezessete"],
      ["pt", "121", "cento e vinte e um"],
      ["pt", "1100", "mil e cem"],
      ["pt", "1234", "mil duzentos e trinta e quatro"],
      ["fr", "17", "dix-sept"],
      ["fr", "21", "vingt et un"],
      ["fr", "71", "soissante et onze"],
      ["fr", "80", "quatre vingts"],
      ["fr", "99", "quatre vingt dix-neuf"],
      ["fr", "1999", "mille neuf cent quatre vingt dix-neuf"],
      ["it", "17", "diciassette"],
      ["it", "21", "ventuno"],
      ["it", "28", "ventotto"],
      ["it", "2000", "due mila"],
      ["de", "17", "siebzehn"],
      ["de", "21", "ein und zwanzig"],
      ["de", "101", "ein hundert eins"],
      ["de", "1999", "neunzehn hundert neun und neunzig"],
      ["tr", "17", "on yedi"],
      ["tr", "1999", "bin dokuz yüz doksan dokuz"],
      ["id", "11", "sebelas"],
      ["id", "17", "tujuh belas"],
      ["id", "2100", "dua ribu seratus"],
      ["ko", "17", "십칠"],
      ["ko", "10000", "만"],
      ["ja", "17", "じゅうなな"],
      ["ja", "300", "さんびゃく"],
      ["ja", "8000", "はっせん"],
      ["zh", "17", "shi qi"],
      ["zh", "101", "yi bai ling yi"],
      ["zh", "1999", "yi jiu jiu jiu"],
      ["zh", "20000", "liang wan"],
      ["ar", "17", "سبعة عشر"],
      ["ar", "21", "واحد وعشرون"],
      ["ar", "١٧", "سبعة عشر"],
    ];
    for (const [language, text, words] of expected) expect(said(text, language), `${language} ${text}`).toBe(words);
  });

  it("uses Korean's native numbers before a counter that takes them", () => {
    expect(said("17", "ko", "살")).toBe("열일곱");
    expect(said("20", "ko", "살이야")).toBe("스무");
    expect(said("17", "ko", "일")).toBe("십칠");
  });

  it("returns null for text without digits", () => {
    expect(numberWords("seventeen", "en")).toBeNull();
  });
});
