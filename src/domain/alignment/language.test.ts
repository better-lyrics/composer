import { coverageColumns, coversLanguage, songLanguage } from "@/domain/alignment/language";
import { describe, expect, it } from "vitest";

const lines = (...texts: string[]) => texts.map((text) => ({ text }));

describe("songLanguage", () => {
  it("uses the project language first, by base tag", () => {
    expect(songLanguage("ja-JP", lines("hello"))).toBe("ja");
    expect(songLanguage("cmn-Hans", lines("hello"))).toBe("zh");
  });

  describe("fallback from the lyrics' script", () => {
    it("reads kana as Japanese, even beside English", () =>
      expect(songLanguage(undefined, lines("君と dance", "さよなら"))).toBe("ja"));
    it("reads Han without kana as Chinese", () => expect(songLanguage(undefined, lines("我爱你"))).toBe("zh"));
    it("reads Hangul as Korean", () => expect(songLanguage(undefined, lines("사랑해"))).toBe("ko"));
    it("reads Latin as English", () => expect(songLanguage(undefined, lines("hold on"))).toBe("en"));
  });

  describe("edge cases", () => {
    it("returns null with no lyrics", () => expect(songLanguage(undefined, [])).toBeNull());
    it("returns null for digits and punctuation only", () =>
      expect(songLanguage(undefined, lines("123 ...!"))).toBeNull());
    it("treats an empty project language as unset", () => expect(songLanguage("", lines("hold on"))).toBe("en"));
  });
});

describe("coversLanguage", () => {
  it("matches base tags and the cmn alias", () => {
    expect(coversLanguage(["en", "zh", "ja"], "zh")).toBe(true);
    expect(coversLanguage(["cmn"], "zh")).toBe(true);
    expect(coversLanguage(["en"], "ja")).toBe(false);
  });
});

describe("coverageColumns", () => {
  it("lists every language once, the song's first", () => {
    expect(
      coverageColumns(
        [
          ["en", "zh", "ja"],
          ["ja", "ko"],
        ],
        "ja",
      ),
    ).toEqual(["ja", "en", "zh", "ko"]);
  });

  it("keeps manifest order without a song language", () => {
    expect(
      coverageColumns(
        [
          ["en", "zh"],
          ["cmn", "ko"],
        ],
        null,
      ),
    ).toEqual(["en", "zh", "ko"]);
  });
});
