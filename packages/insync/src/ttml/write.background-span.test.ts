import { describe, expect, it } from "vitest";
import { drawnSyllables } from "../line-drawn-track";
import type { LyricLine } from "../line";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "../line-track";
import { DEFAULT_SPLIT_CHARACTER } from "../split-character-text";
import { parseTtml } from "./read";
import { generateTTML } from "./write";

const SPLIT = DEFAULT_SPLIT_CHARACTER;

const [imported] = parseTtml(
  `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>
<p begin="1.000" end="4.000" ttm:agent="v1">Lanterns drift over water<span ttm:role="x-bg">(over water)</span></p>
</div></body></tt>`,
  SPLIT,
).lines;

describe("background span", () => {
  it("regression: an imported untimed background of a line-synced paragraph is drawn where the export writes it", () => {
    const drawn = drawnSyllables(imported, "bg", SPLIT);
    expect(drawn.map(({ text, begin, end }) => ({ text, begin, end }))).toEqual([
      { text: "(over water)", begin: 1, end: 4 },
    ]);
    const ttml = generateTTML({
      metadata: { title: "Test", artists: [], album: "", duration: 30 },
      agents: [{ id: "v1", type: "person", name: "Lead" }],
      lines: [imported],
      splitChar: SPLIT,
    });
    expect(ttml).toContain('<span ttm:role="x-bg"><span begin="0:01.000" end="0:04.000">(over water)</span></span>');
  });
});

function readLine(paragraph: string): LyricLine {
  return parseTtml(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>${paragraph}</div></body></tt>`,
    SPLIT,
  ).lines[0];
}

describe("line-synced background read back", () => {
  it("regression: a background written as one timed span of several words reads back line synced, as main does", () => {
    const line = readLine(
      '<p begin="1.000" end="4.000" ttm:agent="v1">Lanterns drift<span ttm:role="x-bg"><span begin="2.500" end="4.000">(ooh ahah)</span></span></p>',
    );
    const background = backgroundTrack(line);
    const main = mainTrack(readLine('<p begin="2.500" end="4.000" ttm:agent="v1">(ooh ahah)</p>'));
    expect(background && isSpanTimed(background) && [background.begin, background.end]).toEqual([2.5, 4]);
    expect(background?.syllables.map(({ text, sep }) => [text, sep])).toEqual(
      main.syllables.map(({ text, sep }) => [text, sep]),
    );
    const ttml = generateTTML({
      metadata: { title: "Test", artists: [], album: "", duration: 30 },
      agents: [{ id: "v1", type: "person", name: "Lead" }],
      lines: [line],
      splitChar: SPLIT,
    });
    expect(ttml).toContain('<span ttm:role="x-bg"><span begin="0:02.500" end="0:04.000">(ooh ahah)</span></span>');
  });

  it("a background written as one timed span of one word stays a timed word", () => {
    const line = readLine(
      '<p begin="1.000" end="4.000" ttm:agent="v1">Lanterns drift<span ttm:role="x-bg"><span begin="2.500" end="4.000">(ooh)</span></span></p>',
    );
    const background = backgroundTrack(line);
    expect(background && isSpanTimed(background)).toBe(false);
    expect(timedSyllables(background).map(({ text, begin, end }) => [text, begin, end])).toEqual([["(ooh)", 2.5, 4]]);
  });
});
