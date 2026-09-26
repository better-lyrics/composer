import { describe, expect, it } from "vitest";
import { rebaseTtmlEdits } from "@/utils/ttml-merge";

// -- Fixtures -----------------------------------------------------------------

const BASE = [
  '<tt dur="10">',
  "  <body>",
  "    <div>",
  '      <p begin="0">one</p>',
  '      <p begin="1">two</p>',
  '      <p begin="2">three</p>',
  "    </div>",
  "  </body>",
  "</tt>",
].join("\n");

// -- Tests --------------------------------------------------------------------

describe("rebaseTtmlEdits", () => {
  describe("happy paths", () => {
    it("cleanly rebases a user edit onto a disjoint regeneration", () => {
      const mine = BASE.replace("one", "ONE EDITED");
      const next = BASE.replace('dur="10"', 'dur="20"');
      const result = rebaseTtmlEdits(BASE, mine, next);
      expect(result.status).toBe("clean");
      if (result.status !== "clean") throw new Error("expected clean");
      expect(result.content).toContain("ONE EDITED");
      expect(result.content).toContain('dur="20"');
    });

    it("merges an insertion in the regeneration with an edit elsewhere", () => {
      const mine = BASE.replace("one", "ONE EDITED");
      const next = BASE.replace(
        '      <p begin="1">two</p>',
        '      <p begin="1">two</p>\n      <p begin="1.5">inserted</p>',
      );
      const result = rebaseTtmlEdits(BASE, mine, next);
      expect(result.status).toBe("clean");
      if (result.status !== "clean") throw new Error("expected clean");
      expect(result.content).toContain("ONE EDITED");
      expect(result.content).toContain("inserted");
    });
  });

  describe("conflicts", () => {
    it("reports a conflict when both sides change the same line differently", () => {
      const mine = BASE.replace("two", "TWO MINE");
      const next = BASE.replace("two", "two NEXT");
      expect(rebaseTtmlEdits(BASE, mine, next).status).toBe("conflict");
    });
  });

  describe("edge cases", () => {
    it("returns next when the user made no edits (mine === base)", () => {
      const next = BASE.replace('dur="10"', 'dur="20"');
      const result = rebaseTtmlEdits(BASE, BASE, next);
      expect(result.status).toBe("clean");
      if (result.status !== "clean") throw new Error("expected clean");
      expect(result.content).toBe(next);
    });

    it("returns mine when there was no drift (base === next)", () => {
      const mine = BASE.replace("one", "ONE EDITED");
      const result = rebaseTtmlEdits(BASE, mine, BASE);
      expect(result.status).toBe("clean");
      if (result.status !== "clean") throw new Error("expected clean");
      expect(result.content).toBe(mine);
    });

    it("treats identical edits on both sides as clean, not a conflict", () => {
      const both = BASE.replace("two", "TWO BOTH");
      const result = rebaseTtmlEdits(BASE, both, both);
      expect(result.status).toBe("clean");
      if (result.status !== "clean") throw new Error("expected clean");
      expect(result.content).toBe(both);
    });

    it("handles empty strings", () => {
      expect(rebaseTtmlEdits("", "", "").status).toBe("clean");
    });

    it("preserves a trailing newline across a clean merge", () => {
      const base = `${BASE}\n`;
      const mine = base.replace("one", "ONE EDITED");
      const next = base.replace('dur="10"', 'dur="20"');
      const result = rebaseTtmlEdits(base, mine, next);
      expect(result.status).toBe("clean");
      if (result.status !== "clean") throw new Error("expected clean");
      expect(result.content.endsWith("\n")).toBe(true);
    });
  });

  describe("invariants", () => {
    it("a clean rebase is idempotent when re-applied to its own output", () => {
      const mine = BASE.replace("one", "ONE EDITED");
      const next = BASE.replace('dur="10"', 'dur="20"');
      const first = rebaseTtmlEdits(BASE, mine, next);
      if (first.status !== "clean") throw new Error("expected clean");
      const second = rebaseTtmlEdits(next, first.content, next);
      expect(second.status).toBe("clean");
      if (second.status !== "clean") throw new Error("expected clean");
      expect(second.content).toBe(first.content);
    });
  });
});
