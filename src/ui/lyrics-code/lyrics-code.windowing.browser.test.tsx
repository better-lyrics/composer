import { render } from "@/test/render";
import { LyricsCode } from "@/ui/lyrics-code/lyrics-code";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const LINE_COUNT = 1000;
const LRC = Array.from({ length: LINE_COUNT }, (_, index) => {
  const seconds = index * 2;
  const stamp = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.00`;
  return `[${stamp}]Paper lanterns drift over line ${index + 1}`;
}).join("\n");

// -- Helpers ------------------------------------------------------------------

function codeIn(container: HTMLElement): HTMLPreElement {
  const pre = container.querySelector("pre");
  if (!pre) throw new Error("lyrics code pane not rendered");
  return pre;
}

function blocksIn(pre: HTMLElement): HTMLElement[] {
  return [...pre.querySelectorAll<HTMLElement>("[data-code-block]")];
}

function isHighlighted(block: HTMLElement): boolean {
  return block.querySelector("[class^='bh-']") !== null;
}

// -- Tests --------------------------------------------------------------------

describe("LyricsCode windowing", () => {
  it("keeps the whole text while highlighting only the blocks near the view", async () => {
    const screen = await render(
      <div style={{ height: 200, overflow: "auto" }}>
        <LyricsCode code={LRC} format="lrc" />
      </div>,
    );
    const pre = codeIn(screen.container);
    expect(pre.textContent).toBe(LRC);

    const blocks = blocksIn(pre);
    const highlighted = blocks.filter(isHighlighted);
    expect(blocks.length).toBeGreaterThan(1);
    expect(highlighted.length).toBeLessThan(blocks.length / 2);
    const tokenSpans = highlighted.reduce((count, block) => count + block.querySelectorAll("span").length, 0);
    expect(pre.querySelectorAll("*").length).toBe(blocks.length + tokenSpans);
    expect(pre.querySelectorAll("*").length).toBeLessThan(LINE_COUNT);

    const scroller = pre.parentElement;
    if (!scroller) throw new Error("scroll container missing");
    scroller.scrollTop = scroller.scrollHeight;
    const lastBlock = blocks.at(-1);
    if (!lastBlock) throw new Error("no code blocks rendered");
    await expect.poll(() => isHighlighted(lastBlock)).toBe(true);
    expect(pre.textContent).toBe(LRC);
  });
});
