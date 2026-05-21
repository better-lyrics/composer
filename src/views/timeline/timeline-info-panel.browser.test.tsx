import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

function selectFirstWordOf(lineId: string): void {
  useTimelineStore.setState({
    selectedWords: [{ lineId, lineIndex: 0, wordIndex: 0, type: "word" }],
  });
}

// -- Tests --------------------------------------------------------------------

describe("TimelineInfoPanel", () => {
  it("renders nothing visible when no words are selected", async () => {
    useTimelineStore.setState({ selectedWords: [] });
    const screen = await render(<TimelineInfoPanel />);
    expect(screen.container.textContent?.trim() ?? "").toBe("");
  });
});

describe("BackgroundTextEditor provenance", () => {
  it("stamps a manual provenance when adding background text", async () => {
    const line = createLine({
      id: "l1",
      text: "hello",
      words: [createWord({ text: "hello", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    selectFirstWordOf("l1");
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: "Add BG" }).click();
    await screen.getByPlaceholder("Background vocals").fill("ooh");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("ooh");
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("flips an extraction-sourced background to manual when edited", async () => {
    const line = createLine({
      id: "l1",
      text: "hello",
      words: [createWord({ text: "hello", begin: 0, end: 1 })],
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({ lines: [line] });
    selectFirstWordOf("l1");
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: "BG: ooh" }).click();
    await screen.getByPlaceholder("Background vocals").fill("aah");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("aah");
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("clears all three background fields when the editor is emptied", async () => {
    const line = createLine({
      id: "l1",
      text: "hello",
      words: [createWord({ text: "hello", begin: 0, end: 1 })],
      backgroundText: "ooh",
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({
      lines: [{ ...line, backgroundWords: [createWord({ text: "ooh", begin: 0, end: 1 })] }],
    });
    selectFirstWordOf("l1");
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: "BG: ooh" }).click();
    await screen.getByPlaceholder("Background vocals").fill("");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBeUndefined();
    expect(useProjectStore.getState().lines[0].backgroundWords).toBeUndefined();
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBeUndefined();
  });
});
