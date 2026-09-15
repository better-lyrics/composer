import { containsNonLatin, detectNonLatinLanguage } from "@/domain/language/script-detection";
import { describe, expect, it } from "vitest";

describe("non-Latin script detection", () => {
  it("detects Hangul inside a mostly Latin lyric line", () => {
    expect(containsNonLatin("걸음은 Like a dance")).toBe(true);
    expect(detectNonLatinLanguage("걸음은 Like a dance")).toBe("ko");
  });

  it("does not treat smart punctuation as non-Latin text", () => {
    expect(containsNonLatin("I don’t even know")).toBe(false);
    expect(detectNonLatinLanguage("I don’t even know")).toBeNull();
  });
});
