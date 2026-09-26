import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { DragGhost, type DragGhostCell } from "@/views/timeline/drag-ghost";

function cell(overrides: Partial<DragGhostCell> = {}): DragGhostCell {
  return { text: "hello", left: 0, top: 0, width: 80, height: 36, syllablePosition: "none", ...overrides };
}

function blocks(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-word-block]")];
}

describe("DragGhost", () => {
  it("renders one block per cell with its text", async () => {
    const screen = await render(
      <DragGhost
        cells={[cell(), cell({ text: "world", left: 90 })]}
        anchorWidth={80}
        anchorHeight={36}
        color="#60a5fa"
        isSnapped={false}
      />,
    );
    await expect.element(screen.getByText("hello")).toBeInTheDocument();
    await expect.element(screen.getByText("world")).toBeInTheDocument();
  });

  it("places and sizes each block from its cell", async () => {
    const screen = await render(
      <DragGhost
        cells={[cell({ left: 12, top: 50, width: 70, height: 28 })]}
        anchorWidth={80}
        anchorHeight={36}
        color="#60a5fa"
        isSnapped={false}
      />,
    );
    const [block] = blocks(screen.container);
    expect([block.style.left, block.style.top, block.style.width, block.style.height]).toEqual([
      "12px",
      "50px",
      "70px",
      "28px",
    ]);
  });

  it("sizes the wrapper to the anchor", async () => {
    const screen = await render(
      <DragGhost cells={[cell()]} anchorWidth={120} anchorHeight={40} color="#60a5fa" isSnapped={false} />,
    );
    const wrapper = screen.container.firstElementChild as HTMLElement;
    expect([wrapper.style.width, wrapper.style.height]).toEqual(["120px", "40px"]);
  });

  it("marks the blocks when snapped", async () => {
    const screen = await render(
      <DragGhost cells={[cell()]} anchorWidth={80} anchorHeight={36} color="#60a5fa" isSnapped />,
    );
    expect(blocks(screen.container)[0].classList.contains("is-snapped")).toBe(true);
  });

  describe("edge cases", () => {
    it("draws a dashed right edge on a leading syllable", async () => {
      const screen = await render(
        <DragGhost
          cells={[cell({ syllablePosition: "first" })]}
          anchorWidth={80}
          anchorHeight={36}
          color="#60a5fa"
          isSnapped={false}
        />,
      );
      expect(blocks(screen.container)[0].style.borderRightStyle).toBe("dashed");
    });

    it("drops the left border on a trailing syllable", async () => {
      const screen = await render(
        <DragGhost
          cells={[cell({ syllablePosition: "last" })]}
          anchorWidth={80}
          anchorHeight={36}
          color="#60a5fa"
          isSnapped={false}
        />,
      );
      expect(blocks(screen.container)[0].style.borderLeftWidth).toBe("0px");
    });

    it("renders nothing inside the wrapper for no cells", async () => {
      const screen = await render(
        <DragGhost cells={[]} anchorWidth={80} anchorHeight={36} color="#60a5fa" isSnapped={false} />,
      );
      expect(blocks(screen.container)).toHaveLength(0);
    });
  });
});
