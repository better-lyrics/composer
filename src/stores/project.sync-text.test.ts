import { beforeEach, describe, expect, it } from "vitest";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { commitGesture } from "@/domain/sync/commit-gesture";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

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
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: "Hello world how are you" })] });

    const commit = commitGesture(useProjectStore.getState().lines, "tap-word", {
      cursor: { lineIndex: 0, wordIndex: 0 },
      jumped: false,
      time: 0,
      defaultWordDuration: 1,
    });
    if (!commit) throw new Error("expected a commit");
    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () => commit.lineUpdates, {
        derivesText: false,
        propagateToSiblings: false,
      }),
    );

    expect(lineText(useProjectStore.getState().lines[0])).toBe("Hello world how are you");
  });

  it("preserves text across a full word-by-word tap sequence", () => {
    useProjectStore.getState().restoreLyrics({ lines: [createLine({ id: "l0", text: "Hello world how are you" })] });

    for (let i = 0; i < 5; i++) {
      const commit = commitGesture(useProjectStore.getState().lines, "tap-word", {
        cursor: { lineIndex: 0, wordIndex: i },
        jumped: false,
        time: i * 0.5,
        defaultWordDuration: 0.4,
      });
      if (!commit) throw new Error("expected a commit");
      useProjectStore.getState().commit(
        lineEditCommand({ command: "edit lines", args: [] }, () => commit.lineUpdates, {
          derivesText: false,
          propagateToSiblings: false,
        }),
      );
      expect(lineText(useProjectStore.getState().lines[0])).toBe("Hello world how are you");
    }
  });

  it("preserves text when the previous line's last word end is patched mid-sync", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [createLine({ id: "l0", text: "Hello world" }), createLine({ id: "l1", text: "Foo bar" })],
    });

    const commit = commitGesture(useProjectStore.getState().lines, "tap-word", {
      cursor: { lineIndex: 0, wordIndex: 0 },
      jumped: false,
      time: 0,
      defaultWordDuration: 1,
    });
    if (!commit) throw new Error("expected a commit");
    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () => commit.lineUpdates, {
        derivesText: false,
        propagateToSiblings: false,
      }),
    );

    const partialPrev = [...timedSyllables(mainTrack(useProjectStore.getState().lines[0]))];
    partialPrev[partialPrev.length - 1] = { ...partialPrev[partialPrev.length - 1], end: 2 };
    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () => [{ id: "l0", updates: { words: partialPrev } }], {
        derivesText: false,
        propagateToSiblings: false,
        copiesSharedTiming: false,
      }),
      "pending",
    );

    expect(lineText(useProjectStore.getState().lines[0])).toBe("Hello world");
  });
});
