import {
  parseGoogleTranslationResponse,
  parseGoogleTransliterationResponse,
} from "@/services/google-language-response";
import { describe, expect, it } from "vitest";

describe("Google response parsing", () => {
  it("joins translated text rows and ignores trailing metadata", () => {
    expect(
      parseGoogleTranslationResponse([
        [
          ["Hello ", "안녕 ", null, null, 10],
          ["world", "세계", null, null, 1, [{ metadata: true }]],
        ],
        null,
        "ko",
      ]),
    ).toEqual({ text: "Hello world", detectedLanguage: "ko" });
  });

  it("allows a valid unchanged translation without detected-language metadata", () => {
    expect(parseGoogleTranslationResponse([[["Hello", "Hello"]]])).toEqual({ text: "Hello", detectedLanguage: "" });
  });

  it.each([
    { name: "third column", rows: [[null, null, "an-nyeong"]], text: "an-nyeong" },
    { name: "fourth column precedence", rows: [[null, null, "unused", "an-nyeong"]], text: "an-nyeong" },
    {
      name: "separate text and romanization rows",
      rows: [
        ["안녕 세계", "안녕 세계", null, null, 5],
        [null, null, "an-nyeong ", "an-nyeong "],
        [null, null, "segye"],
      ],
      text: "an-nyeong segye",
    },
    { name: "no available romanization", rows: [["Hello", "Hello", null, null]], text: "" },
  ])("supports $name", ({ rows, text }) => {
    expect(parseGoogleTransliterationResponse([rows, null, "ko"])).toEqual({ text, detectedLanguage: "ko" });
  });

  it.each([
    { name: "null", value: null },
    { name: "object", value: {} },
    { name: "error envelope", value: { error: "quota" } },
    { name: "missing rows", value: [] },
    { name: "empty rows", value: [[], null, "en"] },
    { name: "object rows", value: [{ text: "Hello" }, null, "en"] },
    { name: "non-array row", value: [[["Hello", "안녕"], null], null, "ko"] },
    { name: "empty row", value: [[[]], null, "ko"] },
    { name: "null-only row", value: [[[null, null, null, null]], null, "ko"] },
    { name: "invalid text field", value: [[[{ text: "Hello" }, "안녕"]], null, "ko"] },
    { name: "invalid romanization field", value: [[["Hello", "안녕", 123]], null, "ko"] },
    { name: "invalid detected language", value: [[["Hello", "안녕"]], null, { language: "ko" }] },
  ])("rejects $name for both operations", ({ value }) => {
    expect(() => parseGoogleTranslationResponse(value)).toThrow("Malformed Google Translate response");
    expect(() => parseGoogleTransliterationResponse(value)).toThrow("Malformed Google Translate response");
  });

  it("rejects romanization-only rows from a translation request", () => {
    expect(() => parseGoogleTranslationResponse([[[null, null, "an-nyeong"]], null, "ko"])).toThrow();
  });
});
