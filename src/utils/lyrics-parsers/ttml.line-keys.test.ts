import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function ttml(body: string, translations = ""): string {
  return `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"><head><metadata><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation xml:lang="es" type="subtitle">${translations}</translation></translations></iTunesMetadata></metadata></head><body><div>${body}</div></body></tt>`;
}

// -- Tests --------------------------------------------------------------------

describe("parseTtml · line keys", () => {
  it("reads each line's itunes:key in document order", () => {
    const parsed = parseTtml(
      ttml(
        '<p begin="0:01.000" end="0:02.000" itunes:key="L2">Two</p><p begin="0:02.000" end="0:03.000">None</p><p begin="0:03.000" end="0:04.000" itunes:key="L1">One</p>',
      ),
    );
    expect(parsed.lines.map((line) => line.text)).toEqual(["Two", "None", "One"]);
    expect(parsed.lineKeys).toEqual(["L2", undefined, "L1"]);
  });

  describe("edge cases", () => {
    it("skips the key of a paragraph that gives no line", () => {
      const parsed = parseTtml(
        ttml(
          '<p begin="0:01.000" end="0:02.000" itunes:key="L1"> </p><p begin="0:02.000" end="0:03.000" itunes:key="L2">Two</p>',
        ),
      );
      expect(parsed.lineKeys).toEqual(["L2"]);
    });

    it("keeps line keys out of the parsed lines", () => {
      const parsed = parseTtml(ttml('<p begin="0:01.000" end="0:02.000" itunes:key="L1">One</p>'));
      expect(Object.keys(parsed.lines[0] ?? {})).not.toContain("key");
    });
  });

  describe("regressions", () => {
    it("regression: a translation for a repeated key belongs to the first paragraph with that key", () => {
      const parsed = parseTtml(
        ttml(
          '<p begin="0:01.000" end="0:02.000" itunes:key="L1">Bravo</p><p begin="0:02.000" end="0:03.000" itunes:key="L1">Bravo again</p>',
          '<text for="L1">Bravo es</text>',
        ),
      );
      expect(parsed.lines[0]?.translations?.es?.text).toBe("Bravo es");
      expect(parsed.lines[1]?.translations).toBeUndefined();
      expect(parsed.lineKeys).toEqual(["L1", "L1"]);
    });
  });
});
