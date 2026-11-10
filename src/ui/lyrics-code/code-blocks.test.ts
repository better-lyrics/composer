import { tokenize } from "@braccato/highlight";
import { describe, expect, it } from "vitest";
import { codeBlocks } from "@/ui/lyrics-code/code-blocks";

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
