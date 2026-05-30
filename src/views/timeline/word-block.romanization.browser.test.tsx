import { describe, expect, it } from "vitest";
import { WordBlock } from "@/views/timeline/word-block";
import { render } from "@/test/render";

const BASE_PROPS = {
  id: "wb-1",
  lineId: "line-1",
  lineIndex: 0,
  wordIndex: 0,
  trackType: "word" as const,
  text: "夜",
  begin: 0,
  end: 1,
  color: "#a3c9ff",
  zoom: 50,
  isDimmed: false,
  isSelected: false,
  onClick: () => {},
  onResizeStart: () => {},
};

// -- Tests --------------------------------------------------------------------

describe("WordBlock romanization subtext", () => {
  it("renders the romaji subtext under the source text when wide enough", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} romanization="yoru" />, { dndContext: true });
    const node = screen.container.querySelector('[data-testid="word-romanization"]') as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.textContent).toBe("yoru");
  });

  it("uses italic style for the romaji subtext", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} romanization="yoru" />, { dndContext: true });
    const node = screen.container.querySelector('[data-testid="word-romanization"]') as HTMLElement;
    expect(node.className).toMatch(/italic/);
  });

  it("does not render the subtext when romanization is undefined", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} />, { dndContext: true });
    expect(screen.container.querySelector('[data-testid="word-romanization"]')).toBeNull();
  });

  it("does not render the subtext when romanization text is empty", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} romanization="" />, { dndContext: true });
    expect(screen.container.querySelector('[data-testid="word-romanization"]')).toBeNull();
  });

  it("hides the subtext when the block is too narrow", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} begin={0} end={0.4} romanization="yoru" />, {
      dndContext: true,
    });
    expect(screen.container.querySelector('[data-testid="word-romanization"]')).toBeNull();
  });

  it("truncates with ellipsis when the romaji text overflows", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} romanization="yoru dakedo tomodachi" />, {
      dndContext: true,
    });
    const node = screen.container.querySelector('[data-testid="word-romanization"]') as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.className).toMatch(/truncate|text-ellipsis/);
  });

  it("does not steal pointer events from the source word block", async () => {
    const screen = await render(<WordBlock {...BASE_PROPS} romanization="yoru" />, { dndContext: true });
    const node = screen.container.querySelector('[data-testid="word-romanization"]') as HTMLElement;
    expect(node.className).toMatch(/pointer-events-none/);
  });

  it("still hits the source word block when clicking", async () => {
    let clicks = 0;
    const screen = await render(
      <WordBlock {...BASE_PROPS} romanization="yoru" onClick={() => clicks++} />,
      { dndContext: true },
    );
    const block = screen.container.querySelector("[data-word-block]") as HTMLElement;
    block.click();
    expect(clicks).toBe(1);
  });
});
