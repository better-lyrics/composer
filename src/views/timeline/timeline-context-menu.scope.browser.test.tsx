import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";

function menuLabels(): string[] {
  return Array.from(document.querySelectorAll("button")).map((button) => button.textContent ?? "");
}

describe("TimelineContextMenu selection scope", () => {
  it("offers only commands that act on the whole selection when several words are selected", async () => {
    const line = createLine({
      text: "every day",
      words: [createWord({ text: "every ", begin: 0, end: 1 }), createWord({ text: "day", begin: 1, end: 2 })],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" },
      },
      selectedWords: [
        { lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" },
        { lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" },
      ],
    });
    await render(<TimelineContextMenu />);

    const labels = menuLabels();
    expect(labels.some((label) => label.startsWith("Merge words"))).toBe(true);
    expect(labels.some((label) => label.startsWith("Mark 2 as explicit"))).toBe(true);
    expect(labels.some((label) => label.startsWith("Edit text"))).toBe(false);
    expect(labels.some((label) => label.startsWith("Split syllables"))).toBe(false);
    expect(labels.some((label) => label.startsWith("Split word"))).toBe(false);
  });
});
