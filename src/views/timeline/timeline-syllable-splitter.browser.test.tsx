import { describe, expect, it } from "vitest";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

describe("TimelineSyllableSplitter", () => {
  it("renders nothing initially (no target word selected)", async () => {
    await render(<TimelineSyllableSplitter />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("ignores the split-syllable event when no word is selected", async () => {
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens the split dialog when the split-syllable event fires for a selected multi-char word", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "hello"/ })).toBeInTheDocument();
  });

  it("ignores the event for single-character words", async () => {
    const line = createLine({ words: [createWord({ text: "a", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    expect(document.querySelector("dialog")).toBeNull();
  });
});
