import { afterEach, describe, expect, it } from "vitest";
import { WordBlock } from "@/views/timeline/word-block";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { render } from "@/test/render";
import { installStyleSheet, installUtilitiesUsedIn } from "@/test/browser-css";

const DEFAULT_PROPS = {
  id: "wb-1",
  lineId: "line-1",
  lineIndex: 0,
  wordIndex: 0,
  trackType: "word" as const,
  text: "hello",
  begin: 1,
  end: 3,
  color: "#a3c9ff",
  zoom: 50,
  isDimmed: false,
  isSelected: false,
  onClick: () => {},
  onResizeStart: () => {},
};

describe("WordBlock", () => {
  it("positions itself based on begin × zoom", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.style.left).toBe("50px");
    // One pixel short of the span, so neighbouring words keep a 1px gap.
    expect(block.style.width).toBe("99px");
  });

  it("hides the text label when natural width is below the threshold (20px)", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} begin={0} end={0.2} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.querySelector("span")).toBeNull();
  });

  it("shows the text label when natural width is at or above the threshold", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} begin={0} end={1} />, { dndContext: true });
    expect(screen.container.querySelector("[data-word-block] > span")?.textContent).toBe("hello");
  });

  it("fires onClick when the block is clicked", async () => {
    let clicks = 0;
    await render(<WordBlock {...DEFAULT_PROPS} onClick={() => clicks++} />, { dndContext: true });
    const block = document.querySelector("[data-word-block]") as HTMLElement;
    block.click();
    expect(clicks).toBe(1);
  });

  it("fires onResizeStart with 'right' and the starting clientX when the right handle is mousedowned", async () => {
    let edge: string | null = null;
    let startX = -1;
    await render(
      <WordBlock
        {...DEFAULT_PROPS}
        onResizeStart={(e, x) => {
          edge = e;
          startX = x;
        }}
      />,
      { dndContext: true },
    );
    const rightEdge = document.querySelector('[data-edge="right"]') as HTMLElement;
    rightEdge.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 142 }));
    expect(edge).toBe("right");
    expect(startX).toBe(142);
  });

  it("fires onResizeStart with 'left' when the left handle is mousedowned", async () => {
    let edge: string | null = null;
    await render(
      <WordBlock
        {...DEFAULT_PROPS}
        onResizeStart={(e) => {
          edge = e;
        }}
      />,
      { dndContext: true },
    );
    const leftEdge = document.querySelector('[data-edge="left"]') as HTMLElement;
    leftEdge.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    expect(edge).toBe("left");
  });

  it("ignores non-primary mouse buttons on the resize handle", async () => {
    let edge: string | null = null;
    await render(
      <WordBlock
        {...DEFAULT_PROPS}
        onResizeStart={(e) => {
          edge = e;
        }}
      />,
      { dndContext: true },
    );
    const rightEdge = document.querySelector('[data-edge="right"]') as HTMLElement;
    rightEdge.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    expect(edge).toBeNull();
  });

  it("dispatches onEdgeHover when the right edge is hovered and unhovered", async () => {
    const events: Array<{ edge: string; hovering: boolean }> = [];
    await render(<WordBlock {...DEFAULT_PROPS} onEdgeHover={(edge, hovering) => events.push({ edge, hovering })} />, {
      dndContext: true,
    });
    const rightEdge = document.querySelector('[data-edge="right"]') as HTMLElement;
    rightEdge.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    rightEdge.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
    expect(events.some((e) => e.edge === "right" && e.hovering === true)).toBe(true);
    expect(events.some((e) => e.edge === "right" && e.hovering === false)).toBe(true);
  });

  it("fires onDoubleClick separately from onClick", async () => {
    let doubles = 0;
    await render(<WordBlock {...DEFAULT_PROPS} onDoubleClick={() => doubles++} />, { dndContext: true });
    const block = document.querySelector("[data-word-block]") as HTMLElement;
    block.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(doubles).toBe(1);
  });

  it("fires onContextMenu (with default prevention) when right-clicked", async () => {
    let contexts = 0;
    let defaultPrevented = false;
    await render(
      <WordBlock
        {...DEFAULT_PROPS}
        onContextMenu={(e) => {
          contexts++;
          defaultPrevented = e.defaultPrevented;
        }}
      />,
      { dndContext: true },
    );
    const block = document.querySelector("[data-word-block]") as HTMLElement;
    block.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(contexts).toBe(1);
    expect(defaultPrevented).toBe(true);
  });

  it("dims when isDimmed is true", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} isDimmed />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("opacity-30");
  });

  it("flags explicit words via the is-explicit-word class", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} isExplicit />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("is-explicit-word");
  });

  it("applies first-syllable rounding (left rounded, right squared)", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="first" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).not.toContain("rounded-l-none");
    expect(block.className).toContain("rounded-r-none");
  });

  it("applies last-syllable rounding (right rounded, left squared)", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="last" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).not.toContain("rounded-r-none");
    expect(block.className).toContain("rounded-l-none");
  });

  it("applies middle-syllable rounding (both sides squared)", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="middle" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("rounded-l-none");
    expect(block.className).toContain("rounded-r-none");
  });

  it("does not apply is-snapped when snappedBlockId is null", async () => {
    useTimelineStore.setState({ snappedBlockId: null });
    const screen = await render(<WordBlock {...DEFAULT_PROPS} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).not.toContain("is-snapped");
  });

  it("applies is-snapped when snappedBlockId matches this block's selfKey", async () => {
    useTimelineStore.setState({ snappedBlockId: "line-1:0:word" });
    const screen = await render(<WordBlock {...DEFAULT_PROPS} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("is-snapped");
  });

  it("does not apply is-snapped when snappedBlockId matches a different block", async () => {
    useTimelineStore.setState({ snappedBlockId: "line-1:1:word" });
    const screen = await render(<WordBlock {...DEFAULT_PROPS} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).not.toContain("is-snapped");
  });

  it("distinguishes main and bg tracks at the same word index", async () => {
    useTimelineStore.setState({ snappedBlockId: "line-1:0:bg" });
    const screen = await render(<WordBlock {...DEFAULT_PROPS} trackType="word" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).not.toContain("is-snapped");
  });

  // Word faces have no border since 2.0, so a detached syllable keeps its own rounded corner instead of a dashed edge.
  it("rounds the left corner of a syllable that has a timing gap before it", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="last" gapBefore />, {
      dndContext: true,
    });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).not.toContain("rounded-l-none");
  });

  it("squares the left corner of a flush syllable with no gap before it", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="last" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("rounded-l-none");
  });

  it("shows cursor-col-resize on the left handle when leftConjoined is true", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} leftConjoined />, { dndContext: true });
    const leftEdge = screen.container.querySelector('[data-edge="left"]') as HTMLElement;
    expect(leftEdge.className).toContain("cursor-col-resize");
    expect(leftEdge.className).not.toContain("cursor-ew-resize");
  });

  it("shows cursor-col-resize on the right handle when rightConjoined is true", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} rightConjoined />, { dndContext: true });
    const rightEdge = screen.container.querySelector('[data-edge="right"]') as HTMLElement;
    expect(rightEdge.className).toContain("cursor-col-resize");
    expect(rightEdge.className).not.toContain("cursor-ew-resize");
  });

  it("shows cursor-col-resize on syllable divider handles by default", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="middle" />, { dndContext: true });
    expect(screen.container.querySelector('[data-edge="left"]')?.className).toContain("cursor-col-resize");
    expect(screen.container.querySelector('[data-edge="right"]')?.className).toContain("cursor-col-resize");
  });

  it("shows cursor-ew-resize on unconjoined syllable dividers when syllable edges do not join", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="middle" syllableEdgesJoin={false} />, {
      dndContext: true,
    });
    expect(screen.container.querySelector('[data-edge="left"]')?.className).toContain("cursor-ew-resize");
    expect(screen.container.querySelector('[data-edge="right"]')?.className).toContain("cursor-ew-resize");
  });

  it("shows cursor-col-resize on a conjoined syllable divider when syllable edges do not join", async () => {
    const screen = await render(
      <WordBlock {...DEFAULT_PROPS} syllablePosition="middle" syllableEdgesJoin={false} rightConjoined />,
      { dndContext: true },
    );
    expect(screen.container.querySelector('[data-edge="right"]')?.className).toContain("cursor-col-resize");
  });

  it("keeps cursor-ew-resize on a plain boundary handle when not conjoined", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} />, { dndContext: true });
    const leftEdge = screen.container.querySelector('[data-edge="left"]') as HTMLElement;
    expect(leftEdge.className).toContain("cursor-ew-resize");
  });

  it("uses the theme-aware text color for the word label", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    // The word face draws its label in the theme ink (`.word-face` in index.css).
    expect(block.className).toContain("word-face");
    expect(block.className).not.toContain("text-white");
  });

  it("uses a theme-aware edge highlight tint", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} leftHighlighted rightHighlighted />, {
      dndContext: true,
    });
    const leftEdge = screen.container.querySelector('[data-edge="left"]') as HTMLElement;
    const rightEdge = screen.container.querySelector('[data-edge="right"]') as HTMLElement;
    expect(leftEdge.className).toContain("bg-composer-text/10");
    expect(rightEdge.className).toContain("bg-composer-text/10");
    expect(leftEdge.className).not.toContain("bg-white/10");
  });

  describe("edge hit areas", () => {
    let styles: HTMLStyleElement[] = [];

    afterEach(() => {
      for (const style of styles) style.remove();
      styles = [];
    });

    async function renderWithRealCss(ui: React.ReactElement) {
      styles.push(installStyleSheet("*,::before,::after{box-sizing:border-box}"));
      const screen = await render(<div className="relative h-10 w-200">{ui}</div>, { dndContext: true });
      styles.push(await installUtilitiesUsedIn(screen.container));
      return screen.container.querySelectorAll<HTMLElement>("[data-word-block]");
    }

    function edgeAt(x: number, y: number): Element | null | undefined {
      return document.elementFromPoint(x, y)?.closest("[data-edge]");
    }

    function edgeOf(block: HTMLElement, side: "left" | "right"): HTMLElement {
      return block.querySelector(`[data-edge="${side}"]`) as HTMLElement;
    }

    it("regression: the border and rounded corners of a word edge resize instead of grabbing the word", async () => {
      const [first, second, firstSyllable, lastSyllable] = await renderWithRealCss(
        <>
          <WordBlock {...DEFAULT_PROPS} rightConjoined />
          <WordBlock {...DEFAULT_PROPS} id="wb-2" wordIndex={1} begin={3} end={5} leftConjoined />
          <WordBlock
            {...DEFAULT_PROPS}
            id="wb-3"
            wordIndex={2}
            begin={6}
            end={7}
            syllablePosition="first"
            syllableEdgesJoin={false}
          />
          <WordBlock
            {...DEFAULT_PROPS}
            id="wb-4"
            wordIndex={3}
            begin={7}
            end={8}
            syllablePosition="last"
            syllableEdgesJoin={false}
          />
        </>,
      );
      const edgeZones = [
        { block: first, side: "left" },
        { block: first, side: "right" },
        { block: second, side: "left" },
        { block: firstSyllable, side: "right" },
        { block: lastSyllable, side: "left" },
      ] as const;
      const misses: string[] = [];
      for (const { block, side } of edgeZones) {
        const rect = block.getBoundingClientRect();
        const handle = edgeOf(block, side);
        for (let offset = 0; offset < handle.offsetWidth; offset++) {
          const x = side === "left" ? rect.left + offset : rect.right - 1 - offset;
          for (let y = rect.top; y < rect.bottom; y++) {
            if (edgeAt(x, y) !== handle) misses.push(`${block.id} ${side} (${x}, ${y})`);
          }
        }
      }
      expect(misses).toEqual([]);
    });

    it("regression: a narrow word keeps its resize handles inside its own bounds", async () => {
      const [narrow] = await renderWithRealCss(<WordBlock {...DEFAULT_PROPS} begin={1} end={1.04} />);
      const rect = narrow.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const outside = [rect.left - 4, rect.left - 2, rect.right + 1, rect.right + 3];
      expect(outside.map((x) => edgeAt(x, midY) ?? null)).toEqual([null, null, null, null]);
      expect(edgeAt(rect.left, midY)).toBe(edgeOf(narrow, "left"));
      expect(edgeAt(rect.right - 1, midY)).toBe(edgeOf(narrow, "right"));
    });
  });
});
