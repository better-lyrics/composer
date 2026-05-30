import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const UNPREFIXED_TTML = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="ja">
  <head>
    <metadata>
      <ttm:agent type="person" xml:id="v1"/>
      <transliterations>
        <transliteration xml:lang="ja-Latn-hepburn">
          <text for="L1">
            <span begin="0:00.833" end="0:01.195">doudemo</span>
            <span begin="0:01.195" end="0:01.887">ii youna</span>
          </text>
        </transliteration>
      </transliterations>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="0:00.833" end="0:01.887" itunes:key="L1" ttm:agent="v1">
        <span begin="0:00.833" end="0:01.195">どうでも</span>
        <span begin="0:01.195" end="0:01.887">いいような</span>
      </p>
    </div>
  </body>
</tt>`;

// -- Import tests -------------------------------------------------------------

describe("TTML import · unprefixed transliterations", () => {
  it("sets metadata.romanizationScheme from <transliteration xml:lang>", () => {
    const result = parseTtml(UNPREFIXED_TTML);
    expect(result.metadata?.romanizationScheme).toBe("ja-Latn-hepburn");
  });

  it("attaches word-level romanization to the matching <p>", () => {
    const result = parseTtml(UNPREFIXED_TTML);
    const line = result.lines[0];
    expect(line?.romanization?.text).toBe("doudemo ii youna");
    expect(line?.romanization?.words?.length).toBe(2);
    expect(line?.romanization?.words?.[0].text).toBe("doudemo");
    expect(line?.romanization?.words?.[0].begin).toBeCloseTo(0.833, 3);
    expect(line?.romanization?.words?.[1].text).toBe("ii youna");
    expect(line?.romanization?.source).toBe("generated");
  });

  it("treats imported romanization as generated (no manual signal in TTML)", () => {
    const result = parseTtml(UNPREFIXED_TTML);
    expect(result.lines[0]?.romanization?.source).toBe("generated");
  });

  it("imports a line-synced (text-only) transliteration", () => {
    const ttml = UNPREFIXED_TTML.replace(/<text for="L1">[\s\S]*?<\/text>/, '<text for="L1">doudemo ii youna</text>');
    const result = parseTtml(ttml);
    const line = result.lines[0];
    expect(line?.romanization?.text).toBe("doudemo ii youna");
    expect(line?.romanization?.words).toBeUndefined();
  });

  it("trims whitespace around line-synced transliteration text", () => {
    const ttml = UNPREFIXED_TTML.replace(
      /<text for="L1">[\s\S]*?<\/text>/,
      '<text for="L1">   doudemo ii youna   </text>',
    );
    const result = parseTtml(ttml);
    expect(result.lines[0]?.romanization?.text).toBe("doudemo ii youna");
  });

  it("ignores <text for> entries that reference an unknown line key", () => {
    const ttml = UNPREFIXED_TTML.replace('for="L1"', 'for="L-unknown"');
    const result = parseTtml(ttml);
    expect(result.lines[0]?.romanization).toBeUndefined();
  });

  it("silently drops unknown schemes (no scheme set, no romanization attached)", () => {
    const ttml = UNPREFIXED_TTML.replace("ja-Latn-hepburn", "ja-Latn-superfake");
    const result = parseTtml(ttml);
    expect(result.metadata?.romanizationScheme).toBeUndefined();
    expect(result.lines[0]?.romanization).toBeUndefined();
  });

  it("does not crash on a transliteration with no xml:lang", () => {
    const ttml = UNPREFIXED_TTML.replace(' xml:lang="ja-Latn-hepburn"', "");
    expect(() => parseTtml(ttml)).not.toThrow();
    const result = parseTtml(ttml);
    expect(result.metadata?.romanizationScheme).toBeUndefined();
  });

  it("does not crash on malformed begin/end attrs on a span (skips just that word)", () => {
    const ttml = UNPREFIXED_TTML.replace('begin="0:00.833" end="0:01.195">doudemo', 'begin="" end="">doudemo');
    expect(() => parseTtml(ttml)).not.toThrow();
    const result = parseTtml(ttml);
    expect(result.lines[0]?.romanization).toBeDefined();
  });

  it("handles XML-escaped characters in the for attribute", () => {
    const escapedTtml = UNPREFIXED_TTML.replace('itunes:key="L1"', 'itunes:key="L&lt;1&amp;"').replace(
      'for="L1"',
      'for="L&lt;1&amp;"',
    );
    const result = parseTtml(escapedTtml);
    expect(result.lines[0]?.romanization?.text).toBe("doudemo ii youna");
  });

  it("picks the first known scheme when multiple transliterations are present", () => {
    const multi = UNPREFIXED_TTML.replace(
      "</transliterations>",
      `<transliteration xml:lang="zh-Latn-pinyin"><text for="L1">should-be-ignored</text></transliteration></transliterations>`,
    );
    const result = parseTtml(multi);
    expect(result.metadata?.romanizationScheme).toBe("ja-Latn-hepburn");
    expect(result.lines[0]?.romanization?.text).toBe("doudemo ii youna");
  });

  it("treats an empty <text for> as no romanization (not attached)", () => {
    const ttml = UNPREFIXED_TTML.replace(/<text for="L1">[\s\S]*?<\/text>/, '<text for="L1"></text>');
    const result = parseTtml(ttml);
    expect(result.lines[0]?.romanization).toBeUndefined();
  });

  it("ignores transliterations when no <p> elements have itunes:key", () => {
    const ttml = UNPREFIXED_TTML.replace(' itunes:key="L1"', "");
    const result = parseTtml(ttml);
    expect(result.lines[0]?.romanization).toBeUndefined();
  });
});
