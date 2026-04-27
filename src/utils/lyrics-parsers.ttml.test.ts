import { describe, expect, it } from "vitest";
import { parseLyricsFile } from "@/utils/lyrics-parsers";

describe("parseLyricsFile - TTML with undeclared namespaces (AMLL)", () => {
  it("parses an AMLL export that uses <amll:meta> without declaring xmlns:amll", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"/><amll:meta key="musicName" value="It Aint Nun"/><amll:meta key="artists" value="CHRIST DILLINGER, Acid Souljah"/><amll:meta key="album" value="It Aint Nun"/></metadata></head><body dur="04:29.370"><div begin="00:01.277" end="04:24.060"><p begin="00:01.277" end="00:02.621" ttm:agent="v1" itunes:key="L1"><span begin="00:01.277" end="00:01.480">Hell</span> <span begin="00:01.480" end="00:01.676">no,</span> <span begin="00:01.676" end="00:01.823">I</span> <span begin="00:01.823" end="00:02.075">can't</span> <span begin="00:02.075" end="00:02.257">be</span> <span begin="00:02.257" end="00:02.411">your</span> <span begin="00:02.411" end="00:02.621">man</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.hasTimingData).toBe(true);

    const firstLine = result.lines[0];
    expect(firstLine.words).toBeDefined();
    expect(firstLine.words?.length).toBe(7);
    expect(firstLine.words?.[0].text).toBe("Hell ");
    expect(firstLine.words?.[0].begin).toBeCloseTo(1.277, 3);
    expect(firstLine.words?.[6].text).toBe("man");
    expect(firstLine.words?.[6].end).toBeCloseTo(2.621, 3);
    expect(firstLine.text).toBe("Hell no, I can't be your man");
  });

  it("does not leak <amll:meta> content into lyrics text", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><amll:meta key="musicName" value="LEAKED_TITLE"/><amll:meta key="artists" value="LEAKED_ARTIST"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:02.000">Hello</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("Hello");
    expect(result.lines[0].text).not.toContain("LEAKED_TITLE");
    expect(result.lines[0].text).not.toContain("LEAKED_ARTIST");
  });

  it("parses well-formed TTML identically (regression guard)", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.500">Hello</span> <span begin="00:01.500" end="00:02.000">world</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("Hello world");
    expect(result.lines[0].words).toHaveLength(2);
    expect(result.lines[0].begin).toBeCloseTo(1.0, 3);
    expect(result.lines[0].end).toBeCloseTo(2.0, 3);
  });

  it("tolerates an undeclared prefix used only in an attribute", () => {
    const content = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1" custom:flag="x"><span begin="00:01.000" end="00:02.000">Hello</span></p></div></body></tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("Hello");
  });
});
