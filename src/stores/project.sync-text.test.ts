import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { commitTappedWord } from "@/utils/sync-helpers";
import { beforeEach, describe, expect, it } from "vitest";

function untimedLine(id: string, text: string): LyricLine {
  return { id, agentId: "v1", text } as LyricLine;
}

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
    useProjectStore.getState().setLines([untimedLine("l0", "Hello world how are you")]);

    const words = commitTappedWord([], 0, "Hello ", 0, 1);
    useProjectStore.getState().updateLineWithHistory("l0", { words }, { deriveText: false });

    expect(useProjectStore.getState().lines[0].text).toBe("Hello world how are you");
  });

  it("preserves text across a full word-by-word tap sequence", () => {
    useProjectStore.getState().setLines([untimedLine("l0", "Hello world how are you")]);

    const taps = ["Hello ", "world ", "how ", "are ", "you"];
    let words: ReturnType<typeof commitTappedWord> = [];
    for (let i = 0; i < taps.length; i++) {
      words = commitTappedWord(words, i, taps[i], i * 0.5, i * 0.5 + 0.4);
      useProjectStore.getState().updateLineWithHistory("l0", { words }, { deriveText: false });
      expect(useProjectStore.getState().lines[0].text).toBe("Hello world how are you");
    }
  });

  it("preserves text when the previous line's last word end is patched mid-sync", () => {
    useProjectStore.getState().setLines([untimedLine("l0", "Hello world"), untimedLine("l1", "Foo bar")]);

    let words: ReturnType<typeof commitTappedWord> = [];
    words = commitTappedWord(words, 0, "Hello ", 0, 1);
    useProjectStore.getState().updateLineWithHistory("l0", { words }, { deriveText: false });

    const partialPrev = [...(useProjectStore.getState().lines[0].words ?? [])];
    partialPrev[partialPrev.length - 1] = { ...partialPrev[partialPrev.length - 1], end: 2 };
    useProjectStore.getState().updateLine("l0", { words: partialPrev }, { deriveText: false });

    expect(useProjectStore.getState().lines[0].text).toBe("Hello world");
  });
});
