import { describe, expect, it } from "vitest";
import { LineRow } from "@/views/timeline/line-row";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { ROMAJI_BAND_HEIGHT } from "@/views/timeline/get-effective-line-main-height";

// -- Tests --------------------------------------------------------------------

describe("LineRow romanization height", () => {
  it("renders the WordTrack at base + ROMAJI_BAND_HEIGHT when the line has romanization", async () => {
    const line = createLine({
      text: "夜だけど",
      words: [createWord({ text: "夜だけど", begin: 0, end: 1 })],
      romanization: { text: "yoru dakedo", source: "generated" },
    });
    useProjectStore.setState({ lines: [line] });
    const base = useTimelineStore.getState().defaultRowHeight;
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const expected = base + ROMAJI_BAND_HEIGHT;
    const sized = Array.from(screen.container.querySelectorAll<HTMLElement>("[style*='height']")).find(
      (el) => el.style.height === `${expected}px`,
    );
    expect(sized).toBeDefined();
  });

  it("renders the WordTrack at base height when the line has no romanization", async () => {
    const line = createLine({
      text: "Hello world",
      words: [createWord({ text: "Hello world", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    const base = useTimelineStore.getState().defaultRowHeight;
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const sized = Array.from(screen.container.querySelectorAll<HTMLElement>("[style*='height']")).find(
      (el) => el.style.height === `${base}px`,
    );
    expect(sized).toBeDefined();
  });

  it("respects user resize handle: base + ROMAJI_BAND_HEIGHT when row override is set", async () => {
    const customBase = 80;
    const line = createLine({
      text: "夜だけど",
      words: [createWord({ text: "夜だけど", begin: 0, end: 1 })],
      romanization: { text: "yoru dakedo", source: "generated" },
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState((s) => ({ rowHeights: { ...s.rowHeights, [line.id]: customBase } }));
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const expected = customBase + ROMAJI_BAND_HEIGHT;
    const sized = Array.from(screen.container.querySelectorAll<HTMLElement>("[style*='height']")).find(
      (el) => el.style.height === `${expected}px`,
    );
    expect(sized).toBeDefined();
  });
});
