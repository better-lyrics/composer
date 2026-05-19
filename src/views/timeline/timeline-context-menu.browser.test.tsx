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

  it("shows 'Merge syllables' on a syllable-group word and collapses the group to one word when clicked", async () => {
    const line = createLine({
      words: [
        createWord({ text: "ev", begin: 0, end: 0.3, syllableGroupId: "g_every" }),
        createWord({ text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g_every" }),
        createWord({ text: "y", begin: 0.6, end: 1, syllableGroupId: "g_every" }),
      ],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" },
      },
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    const mergeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Merge syllables/i.test(b.textContent ?? ""),
    );
    expect(mergeBtn).toBeDefined();
    mergeBtn?.click();

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe("every");
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(1);
    expect(words[0].syllableGroupId).toBeUndefined();
  });

  it("hides 'Merge syllables' on a standalone word", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" },
      },
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    const mergeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Merge syllables/i.test(b.textContent ?? ""),
    );
    expect(mergeBtn).toBeUndefined();
  });

  it("shows 'Split word' on a word target and dispatches timeline:split-word when clicked", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);

    const splitWordBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Split word"),
    );
    expect(splitWordBtn).toBeDefined();

    let dispatched = false;
    const onSplitWord = () => {
      dispatched = true;
    };
    window.addEventListener("timeline:split-word", onSplitWord);
    splitWordBtn?.click();
    window.removeEventListener("timeline:split-word", onSplitWord);

    expect(dispatched).toBe(true);
  });

  it("snaps a gapped syllable group flush when 'Snap syllables flush' is clicked", async () => {
    const line = createLine({
      words: [
        createWord({ text: "beau", begin: 0, end: 0.3, syllableGroupId: "g_beau" }),
        createWord({ text: "ti", begin: 0.5, end: 0.8, syllableGroupId: "g_beau" }),
        createWord({ text: "ful", begin: 1.0, end: 1.3, syllableGroupId: "g_beau" }),
      ],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" },
      },
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    const snapBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Snap syllables flush/i.test(b.textContent ?? ""),
    );
    expect(snapBtn).toBeDefined();
    snapBtn?.click();

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[0].end).toBe(words[1].begin);
    expect(words[1].end).toBe(words[2].begin);
    expect(words[0].begin).toBe(0);
    expect(words[2].end).toBe(1.3);
  });
});
