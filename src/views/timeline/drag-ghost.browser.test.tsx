import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { createLine, createWord } from "@/test/factories";
import { DragGhost, type DragGhostCell, HoverSizedDragGhost } from "@/views/timeline/drag-ghost";
import { useTimelineStore } from "@/views/timeline/timeline-store";

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

describe("HoverSizedDragGhost", () => {
  const lines = [
    createLine({ id: "a", words: [createWord({ text: "one", begin: 0, end: 1 })] }),
    createLine({ id: "b", words: [createWord({ text: "two", begin: 2, end: 3 })] }),
  ];

  async function renderGhost(cells: DragGhostCell[]) {
    return render(
      <HoverSizedDragGhost
        lines={lines}
        cells={cells}
        anchorWidth={80}
        anchorHeight={36}
        color="#60a5fa"
        isSnapped={false}
      />,
    );
  }

  function heights(container: HTMLElement): number[] {
    return blocks(container).map((block) => Number.parseFloat(block.style.height));
  }

  it("keeps the source height with no hovered track", async () => {
    useTimelineStore.setState({ wordDragHover: null });
    const screen = await renderGhost([cell()]);
    expect(heights(screen.container)).toEqual([36]);
  });

  it("fits a single word to the hovered empty BG zone", async () => {
    useTimelineStore.setState({ wordDragHover: { lineIndex: 1, track: "bg" }, rowHeights: {}, defaultRowHeight: 44 });
    const screen = await renderGhost([cell()]);
    expect(heights(screen.container)).toEqual([16]);
  });

  it("fits a single word to a resized row's main track", async () => {
    useTimelineStore.setState({
      wordDragHover: { lineIndex: 1, track: "word" },
      rowHeights: { b: 80 },
      defaultRowHeight: 44,
    });
    const screen = await renderGhost([cell()]);
    expect(heights(screen.container)).toEqual([72]);
  });

  describe("regressions", () => {
    it("regression: fits every word of a same-track selection to the hovered BG zone", async () => {
      useTimelineStore.setState({ wordDragHover: { lineIndex: 1, track: "bg" }, rowHeights: {}, defaultRowHeight: 44 });
      const screen = await renderGhost([cell(), cell({ text: "two", left: 90 })]);
      expect(heights(screen.container)).toEqual([16, 16]);
      expect((screen.container.firstElementChild as HTMLElement).style.height).toBe("16px");
    });
  });

  describe("edge cases", () => {
    it("keeps the layout of a selection that spans several rows", async () => {
      useTimelineStore.setState({ wordDragHover: { lineIndex: 1, track: "bg" }, rowHeights: {}, defaultRowHeight: 44 });
      const screen = await renderGhost([cell(), cell({ text: "two", top: 69, height: 36 })]);
      expect(heights(screen.container)).toEqual([36, 36]);
    });

    it("keeps the source height when the hovered line index is out of range", async () => {
      useTimelineStore.setState({ wordDragHover: { lineIndex: 9, track: "word" } });
      const screen = await renderGhost([cell()]);
      expect(heights(screen.container)).toEqual([36]);
    });
  });
});
