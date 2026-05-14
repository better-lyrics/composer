import { describe, expect, it } from "vitest";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

function openWordContextMenu(lineId: string) {
  useTimelineStore.setState({
    contextMenu: {
      x: 100,
      y: 100,
      target: { kind: "word", lineId, lineIndex: 0, wordIndex: 0, type: "word" },
    },
    selectedWords: [{ lineId, lineIndex: 0, wordIndex: 0, type: "word" }],
  });
}

describe("TimelineContextMenu", () => {
  it("renders nothing when no context menu is set", async () => {
    useTimelineStore.setState({ contextMenu: null });
    await render(<TimelineContextMenu />);
    const explicitButton = Array.from(document.querySelectorAll("button")).find((b) =>
      /explicit/i.test(b.textContent ?? ""),
    );
    expect(explicitButton).toBeUndefined();
  });

  it("opens the menu when contextMenu state is set", async () => {
    const line = createLine({ words: [createWord({ text: "hi", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);
    expect(document.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("dismisses the menu when an outside click occurs", async () => {
    const line = createLine({ words: [createWord({ text: "hi", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);
    expect(useTimelineStore.getState().contextMenu).not.toBeNull();
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(useTimelineStore.getState().contextMenu).toBeNull();
  });

  it("toggles word explicit flag when the 'Mark explicit' action is invoked", async () => {
    const line = createLine({
      words: [createWord({ text: "darn", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);
    const explicitButton = Array.from(document.querySelectorAll("button")).find((b) =>
      /explicit/i.test(b.textContent ?? ""),
    );
    expect(explicitButton).toBeDefined();
    explicitButton?.click();
    const updated = useProjectStore.getState().lines[0].words?.[0];
    expect(updated?.explicit).toBe(true);
  });
});
