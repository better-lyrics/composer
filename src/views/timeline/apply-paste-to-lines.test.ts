import { describe, expect, it } from "vitest";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { applyPasteToLines } from "@/views/timeline/apply-paste-to-lines";
import type { ClipboardData } from "@/views/timeline/selection-types";

// -- Helpers ------------------------------------------------------------------

const line = (id: string, words: WordTiming[], text: string): LyricLine =>
  reconcileLine({ id, agentId: "a", text, words });

// -- Tests --------------------------------------------------------------------

describe("applyPasteToLines", () => {
  describe("happy paths", () => {
    it("re-derives main text from the new words after pasting onto an existing line", () => {
      const lines = [
        line(
          "l1",
          [
            { text: "a ", begin: 0, end: 0.5 },
            { text: "b", begin: 0.5, end: 1 },
          ],
          "a b",
        ),
      ];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 2, end: 2.5 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(updates).not.toBeNull();
      expect(updates?.[0].updates.text).toBeDefined();
      expect(updates?.[0].updates.text).not.toBe("a b");
      expect(updates?.[0].updates.text).toContain("z");
    });

    it("re-derives bg text on bg paste", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 0.5 }], "a")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "bgw", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "bg" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(updates).not.toBeNull();
      expect((updates?.[0].updates as { backgroundText?: string }).backgroundText).toBeDefined();
    });

    it("distributes entries across multiple destination lines via lineOffset", () => {
      const lines = [
        line("l1", [{ text: "a", begin: 0, end: 0.5 }], "a"),
        line("l2", [{ text: "b", begin: 0, end: 0.5 }], "b"),
      ];
      const clipboard: ClipboardData = {
        entries: [
          { word: { text: "x", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "word" },
          { word: { text: "y", begin: 2, end: 2.5 }, lineOffset: 1, trackType: "word" },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(updates).not.toBeNull();
      expect(updates).toHaveLength(2);
      const byId = new Map(updates?.map((u) => [u.id, u]));
      expect(byId.get("l1")?.updates.words?.some((w) => w.text === "x")).toBe(true);
      expect(byId.get("l2")?.updates.words?.some((w) => w.text === "y")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns null when an entry would land at an out-of-bounds line index", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 1 }], "a")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 0, end: 0.5 }, lineOffset: 5, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(updates).toBeNull();
    });

    it("returns null when targetLineIndex is negative", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 1 }], "a")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 0, end: 0.5 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: -1, timeDelta: 0, duration: 10 });
      expect(updates).toBeNull();
    });

    it("clamps new word times to [0, duration]", () => {
      const lines = [line("l1", [], "")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: -5, end: 100 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(updates?.[0].updates.words?.[0].begin).toBe(0);
      expect(updates?.[0].updates.words?.[0].end).toBe(10);
    });

    it("handles a clipboard with mixed word and bg entries on the same line", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 0.5 }], "a")];
      const clipboard: ClipboardData = {
        entries: [
          { word: { text: "mw", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "word" },
          { word: { text: "bw", begin: 2, end: 2.5 }, lineOffset: 0, trackType: "bg" },
        ],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(updates?.[0].updates.words?.some((w) => w.text === "mw")).toBe(true);
      expect(
        (updates?.[0].updates as { backgroundWords?: Array<{ text: string }> }).backgroundWords?.some(
          (w) => w.text === "bw",
        ),
      ).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not mutate input lines", () => {
      const lines = [line("l1", [{ text: "a", begin: 0, end: 1 }], "a")];
      const before = JSON.stringify(lines);
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 1, end: 1.5 }, lineOffset: 0, trackType: "word" }],
      };
      applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 0, duration: 10 });
      expect(JSON.stringify(lines)).toBe(before);
    });

    it("applies timeDelta to all pasted entries", () => {
      const lines = [line("l1", [], "")];
      const clipboard: ClipboardData = {
        entries: [{ word: { text: "z", begin: 1, end: 2 }, lineOffset: 0, trackType: "word" }],
      };
      const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: 0, timeDelta: 2, duration: 10 });
      expect(updates?.[0].updates.words?.[0].begin).toBe(3);
      expect(updates?.[0].updates.words?.[0].end).toBe(4);
    });
  });
});
