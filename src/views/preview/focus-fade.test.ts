import { isOutsideFocus, markLinesOutsideFocus } from "@/views/preview/focus-fade";
import { OUTSIDE_FOCUS_ATTRIBUTE } from "@/views/preview/lyrics-layout";
import { describe, expect, it } from "vitest";

const chorus = { begin: 40, end: 48 };

const lineAt = (startSeconds: number) => ({ element: document.createElement("div"), startSeconds });

describe("isOutsideFocus", () => {
  it("is true before and after the range", () => {
    expect(isOutsideFocus(39, chorus)).toBe(true);
    expect(isOutsideFocus(49, chorus)).toBe(true);
  });

  it("is false inside the range, including both edges", () => {
    expect(isOutsideFocus(40, chorus)).toBe(false);
    expect(isOutsideFocus(44, chorus)).toBe(false);
    expect(isOutsideFocus(48, chorus)).toBe(false);
  });

  describe("edge cases", () => {
    it("treats a line a hair before the start as inside", () => {
      expect(isOutsideFocus(39.999, chorus)).toBe(false);
    });
  });
});

describe("markLinesOutsideFocus", () => {
  it("marks only the lines that start outside the range", () => {
    const lines = [lineAt(10), lineAt(42), lineAt(60)];
    markLinesOutsideFocus(lines, chorus);
    expect(lines.map((line) => line.element.hasAttribute(OUTSIDE_FOCUS_ATTRIBUTE))).toEqual([true, false, true]);
  });

  describe("edge cases", () => {
    it("clears every mark when there is no range", () => {
      const lines = [lineAt(10), lineAt(42)];
      markLinesOutsideFocus(lines, chorus);
      markLinesOutsideFocus(lines, null);
      expect(lines.some((line) => line.element.hasAttribute(OUTSIDE_FOCUS_ATTRIBUTE))).toBe(false);
    });

    it("does nothing for no lines", () => {
      expect(() => markLinesOutsideFocus([], chorus)).not.toThrow();
    });
  });
});
