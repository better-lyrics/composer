import { describe, expect, it } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { detectNonLatinLanguage, linesEligibleForRomanization } from "@/domain/romanization/detect";

describe("detectNonLatinLanguage", () => {
  it.each([
    ["夜だけど", "ja"],
    ["カタカナ", "ja"],
    ["銀行", "zh"],
    ["银行", "zh"],
    ["안녕하세요", "ko"],
    ["สวัสดี", "th"],
    ["Привет", "ru"],
    ["Καλημέρα", "el"],
    ["مرحبا", "ar"],
    ["שלום", "he"],
    ["नमस्ते", "hi"],
    ["ওহে", "bn"],
  ])("recognises %s as %s", (text, expected) => {
    expect(detectNonLatinLanguage(text)).toBe(expected);
  });

  it("returns null for all-Latin text", () => {
    expect(detectNonLatinLanguage("Hello world")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectNonLatinLanguage("")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(detectNonLatinLanguage("  \n  ")).toBeNull();
  });

  it("returns zh for han with co-present latin (priority drives the result)", () => {
    expect(detectNonLatinLanguage("Hello 夜")).toBe("zh");
  });

  it("prefers hiragana over han for mixed ja text", () => {
    expect(detectNonLatinLanguage("夜だけど 朝が来るまで")).toBe("ja");
  });

  it("returns 'und' for an unrecognised non-Latin script (e.g. Tibetan)", () => {
    expect(detectNonLatinLanguage("བཀྲ་ཤིས་བདེ་ལེགས")).toBe("und");
  });
});

describe("linesEligibleForRomanization", () => {
  it("returns only lines containing non-Latin characters", () => {
    const lines = [
      reconcileLine({ id: "L1", text: "Hello world", agentId: "v1", begin: 0, end: 1 }),
      reconcileLine({ id: "L2", text: "夜だけど", agentId: "v1", begin: 1, end: 2 }),
      reconcileLine({ id: "L3", text: "안녕", agentId: "v1", begin: 2, end: 3 }),
    ];
    const result = linesEligibleForRomanization(lines);
    expect(result.map((l) => l.id)).toEqual(["L2", "L3"]);
  });

  it("returns an empty array when no lines are eligible", () => {
    const lines = [reconcileLine({ id: "L1", text: "Hello", agentId: "v1", begin: 0, end: 1 })];
    expect(linesEligibleForRomanization(lines)).toEqual([]);
  });
});
