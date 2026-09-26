import { commitGesture } from "@/domain/sync/commit-gesture";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

describe("sync incremental tap preserves line.text", () => {
  beforeEach(() => {
    useProjectStore.setState({
      lines: [],
      groups: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      isDirtySinceHistory: false,
    });
  });

  it("preserves text after the first-word tap on a fresh line", () => {
    useProjectStore.getState().setLines([createLine({ id: "l0", text: "Hello world how are you" })]);

    const commit = commitGesture(useProjectStore.getState().lines, "tap-word", {
      cursor: { lineIndex: 0, wordIndex: 0 },
      jumped: false,
      time: 0,
      defaultWordDuration: 1,
    });
    if (!commit) throw new Error("expected a commit");
    useProjectStore
      .getState()
      .updateLinesWithHistory(commit.lineUpdates, { deriveText: false, propagateToSiblings: false });

    expect(useProjectStore.getState().lines[0].text).toBe("Hello world how are you");
  });

  it("preserves text across a full word-by-word tap sequence", () => {
    useProjectStore.getState().setLines([createLine({ id: "l0", text: "Hello world how are you" })]);

    for (let i = 0; i < 5; i++) {
      const commit = commitGesture(useProjectStore.getState().lines, "tap-word", {
        cursor: { lineIndex: 0, wordIndex: i },
        jumped: false,
        time: i * 0.5,
        defaultWordDuration: 0.4,
      });
      if (!commit) throw new Error("expected a commit");
      useProjectStore
        .getState()
        .updateLinesWithHistory(commit.lineUpdates, { deriveText: false, propagateToSiblings: false });
      expect(useProjectStore.getState().lines[0].text).toBe("Hello world how are you");
    }
  });

  it("preserves text when the previous line's last word end is patched mid-sync", () => {
    useProjectStore
      .getState()
      .setLines([createLine({ id: "l0", text: "Hello world" }), createLine({ id: "l1", text: "Foo bar" })]);

    const commit = commitGesture(useProjectStore.getState().lines, "tap-word", {
      cursor: { lineIndex: 0, wordIndex: 0 },
      jumped: false,
      time: 0,
      defaultWordDuration: 1,
    });
    if (!commit) throw new Error("expected a commit");
    useProjectStore
      .getState()
      .updateLinesWithHistory(commit.lineUpdates, { deriveText: false, propagateToSiblings: false });

    const partialPrev = [...(useProjectStore.getState().lines[0].words ?? [])];
    partialPrev[partialPrev.length - 1] = { ...partialPrev[partialPrev.length - 1], end: 2 };
    useProjectStore.getState().updateLine("l0", { words: partialPrev }, { deriveText: false });

    expect(useProjectStore.getState().lines[0].text).toBe("Hello world");
  });
});
