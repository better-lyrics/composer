import { describe, expect, it } from "vitest";
import { WordBlock } from "@/views/timeline/word-block";
import { render } from "@/test/render";

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
    expect(block.style.width).toBe("100px");
  });

  it("widens minimum render width to 4px when natural width is sub-pixel", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} begin={0} end={0.02} />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.style.width).toBe("4px");
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
    await render(<WordBlock {...DEFAULT_PROPS} onResizeStart={(e) => (edge = e)} />, { dndContext: true });
    const leftEdge = document.querySelector('[data-edge="left"]') as HTMLElement;
    leftEdge.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    expect(edge).toBe("left");
  });

  it("ignores non-primary mouse buttons on the resize handle", async () => {
    let edge: string | null = null;
    await render(<WordBlock {...DEFAULT_PROPS} onResizeStart={(e) => (edge = e)} />, { dndContext: true });
    const rightEdge = document.querySelector('[data-edge="right"]') as HTMLElement;
    rightEdge.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    expect(edge).toBeNull();
  });

  it("dispatches onEdgeHover when the right edge is hovered and unhovered", async () => {
    const events: Array<{ edge: string; hovering: boolean }> = [];
    await render(
      <WordBlock {...DEFAULT_PROPS} onEdgeHover={(edge, hovering) => events.push({ edge, hovering })} />,
      { dndContext: true },
    );
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
    expect(block.className).toContain("rounded-l-xl");
    expect(block.className).toContain("rounded-r-none");
  });

  it("applies last-syllable rounding (right rounded, left squared)", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="last" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("rounded-r-xl");
    expect(block.className).toContain("rounded-l-none");
  });

  it("applies middle-syllable rounding (both sides squared)", async () => {
    const screen = await render(<WordBlock {...DEFAULT_PROPS} syllablePosition="middle" />, { dndContext: true });
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    expect(block.className).toContain("rounded-none");
  });
});
