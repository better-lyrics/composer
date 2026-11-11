import { tokenize } from "@braccato/highlight";
import { describe, expect, it } from "vitest";
import { codeBlocks, highlightedBlocks } from "@/ui/lyrics-code/code-blocks";

const TTML = [
  '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">',
  "  <body>",
  '    <div begin="00:01.000" end="00:09.000">',
  '      <p begin="00:01.000" end="00:04.000" ttm:agent="v1"><span begin="00:01.000" end="00:02.000">Paper </span><span begin="00:02.000" end="00:04.000">lanterns</span><span ttm:role="x-bg"><span begin="00:03.000" end="00:04.000">(drifting)</span></span></p>',
  '      <p begin="00:04.500" end="00:09.000" ttm:agent="v2"><span begin="00:04.500" end="00:09.000">upstream</span></p>',
  "    </div>",
  "  </body>",
  "</tt>",
  "",
].join("\n");

describe("codeBlocks", () => {
  it("cuts tokens into blocks of whole lines that rebuild the source with the same token types", () => {
    const tokens = tokenize(TTML, "ttml");
    const blocks = codeBlocks(tokens, 3);

    expect(blocks.map((block) => block.text).join("")).toBe(TTML);
    expect(blocks.map((block) => block.text.split("\n").length - 1)).toEqual([3, 3, 2]);
    for (const block of blocks) expect(block.tokens.map((token) => token.text).join("")).toBe(block.text);

    const typeAt = (tokenList: typeof tokens) =>
      tokenList.flatMap((token) => Array.from(token.text, () => token.type)).join(",");
    expect(blocks.map((block) => typeAt(block.tokens)).join(",")).toBe(typeAt(tokens));
  });
});

describe("highlightedBlocks", () => {
  const noSelection = () => false;
  const ids = (from: number, to: number) => new Set(Array.from({ length: to - from + 1 }, (_, index) => from + index));

  it("highlights every block near the view", () => {
    const next = highlightedBlocks({
      previous: [],
      near: ids(3, 6),
      kept: ids(1, 8),
      cap: 10,
      holdsSelection: noSelection,
    });
    expect(new Set(next)).toEqual(ids(3, 6));
  });

  it("keeps a block that left the near zone until it leaves the release zone", () => {
    const kept = highlightedBlocks({
      previous: [3, 4, 5, 6],
      near: ids(5, 8),
      kept: ids(4, 10),
      cap: 10,
      holdsSelection: noSelection,
    });
    expect(new Set(kept)).toEqual(ids(4, 8));
  });

  it("drops the oldest blocks past the cap, never one near the view", () => {
    const next = highlightedBlocks({
      previous: [0, 1, 2, 3, 4, 5],
      near: ids(4, 7),
      kept: ids(0, 9),
      cap: 6,
      holdsSelection: noSelection,
    });
    expect(next).toHaveLength(6);
    expect(new Set(next)).toEqual(ids(2, 7));
    const crowded = highlightedBlocks({
      previous: [],
      near: ids(0, 7),
      kept: ids(0, 9),
      cap: 6,
      holdsSelection: noSelection,
    });
    expect(new Set(crowded)).toEqual(ids(0, 7));
  });

  it("keeps a block holding the selection, even far away and over the cap", () => {
    const next = highlightedBlocks({
      previous: [0, 1, 2, 3],
      near: ids(2, 5),
      kept: ids(1, 6),
      cap: 3,
      holdsSelection: (index) => index === 0,
    });
    expect(next).toContain(0);
    expect(next).not.toContain(1);
    expect(new Set(next)).toEqual(new Set([0, 2, 3, 4, 5]));
  });
});
