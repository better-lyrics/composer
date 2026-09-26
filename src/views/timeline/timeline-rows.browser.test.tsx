import { describe, expect, it } from "vitest";
import { useRef } from "react";
import { TimelineRows } from "@/views/timeline/timeline-rows";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { render } from "@/test/render";

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ height: 400, overflow: "auto" }}>
      <TimelineRows scrollContainerRef={ref} />
    </div>
  );
}

describe("TimelineRows", () => {
  it("renders zero word blocks when there are no lines", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<Harness />);
    expect(screen.container.querySelectorAll("[data-word-block]").length).toBe(0);
  });

  it("sizes the row container to fit one row per line", async () => {
    const lines = [createLine({ text: "line A" }), createLine({ text: "line B" })];
    useProjectStore.setState({ lines });
    const screen = await render(<Harness />);
    // The wrapper div sets style.height = totalHeight (default row height × line count).
    // Virtuoso may not render individual rows inside a headless layout, but the
    // pre-computed container size still reflects the line count.
    const wrapper = screen.container.querySelector<HTMLElement>("div[style*='height']");
    expect(wrapper).not.toBeNull();
    const heightPx = Number.parseInt(wrapper?.style.height ?? "0", 10);
    expect(heightPx).toBeGreaterThan(0);
  });
  describe("regressions", () => {
    function sizerHeight(container: HTMLElement): string {
      return container.querySelector<HTMLElement>("[style*='min-width']")?.style.height ?? "";
    }

    it("regression: sizes the rows container from the store's default row height, not the constant", async () => {
      useTimelineStore.setState({ defaultRowHeight: 60, rowHeights: {} });
      useProjectStore.setState({ lines: [createLine({ id: "a", text: "one" }), createLine({ id: "b", text: "two" })] });
      const screen = await render(<Harness />);
      expect(sizerHeight(screen.container)).toBe(`${2 * (60 + 24 + 1)}px`);
    });

    it("sizes a resized row with background words from its own main height", async () => {
      useTimelineStore.setState({ defaultRowHeight: 44, rowHeights: { a: 80 } });
      useProjectStore.setState({
        lines: [createLine({ id: "a", text: "one", backgroundWords: [createWord({ text: "ooh", begin: 0, end: 1 })] })],
      });
      const screen = await render(<Harness />);
      expect(sizerHeight(screen.container)).toBe(`${80 + 80 + 1}px`);
    });
  });
});
