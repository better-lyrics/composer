import { describe, expect, it } from "vitest";
import { drawnSyllables } from "../line-drawn-track";
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
