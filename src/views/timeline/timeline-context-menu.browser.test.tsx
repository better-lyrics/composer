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

  it("shows 'Merge into syllable group' for a contiguous multi-word selection and stamps a shared id when clicked", async () => {
    const line = createLine({
      words: [
        createWord({ text: "ev", begin: 0, end: 0.3 }),
        createWord({ text: "er", begin: 0.3, end: 0.6 }),
        createWord({ text: "y", begin: 0.6, end: 1 }),
      ],
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
        { lineId: line.id, lineIndex: 0, wordIndex: 2, type: "word" },
      ],
    });
    await render(<TimelineContextMenu />);

    const mergeIntoSyllablesBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Merge into syllable group/i.test(b.textContent ?? ""),
    );
    expect(mergeIntoSyllablesBtn).toBeDefined();
    mergeIntoSyllablesBtn?.click();

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words[0].syllableGroupId).toBeDefined();
    expect(words.every((w) => w.syllableGroupId === words[0].syllableGroupId)).toBe(true);
  });

  it("hides 'Merge into syllable group' for a non-contiguous selection", async () => {
    const line = createLine({
      words: [
        createWord({ text: "a", begin: 0, end: 0.3 }),
        createWord({ text: "b", begin: 0.3, end: 0.6 }),
        createWord({ text: "c", begin: 0.6, end: 1 }),
      ],
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
        { lineId: line.id, lineIndex: 0, wordIndex: 2, type: "word" },
      ],
    });
    await render(<TimelineContextMenu />);

    const mergeIntoSyllablesBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Merge into syllable group/i.test(b.textContent ?? ""),
    );
    expect(mergeIntoSyllablesBtn).toBeUndefined();
  });
});
