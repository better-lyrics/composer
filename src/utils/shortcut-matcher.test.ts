import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS } from "@/stores/shortcut-definitions";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { bubbles: true, ...init });
}

describe("findMatchingShortcut", () => {
  describe("happy paths", () => {
    it("matches a first keydown to its shortcut", () => {
      expect(findMatchingShortcut(keydown({ key: "r" }), "timeline")).toBe("timeline.toggleRollingEdit");
    });

    it("matches held-key repeats of a repeatable shortcut", () => {
      expect(findMatchingShortcut(keydown({ key: "ArrowRight", repeat: true }), "timeline")).toBe(
        "timeline.nudgeRight",
      );
    });
  });

  describe("regressions", () => {
    it("regression: a held toggle key does not re-fire the toggle on every auto-repeat", () => {
      expect(findMatchingShortcut(keydown({ key: "r", repeat: true }), "timeline")).toBeNull();
    });

    it("regression: a held insert-line key does not insert a line per auto-repeat", () => {
      expect(findMatchingShortcut(keydown({ key: "n", repeat: true }), "timeline")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for a key with no binding in the scope", () => {
      expect(findMatchingShortcut(keydown({ key: "F13" }), "timeline")).toBeNull();
    });
  });

  describe("invariants", () => {
    it("only nudges and jumps opt into auto-repeat", () => {
      const repeatable = SHORTCUT_DEFINITIONS.filter((definition) => definition.repeatable).map(({ id }) => id);
      for (const id of repeatable) {
        expect(id).toMatch(/\.(nudge|jump)/);
      }
      expect(repeatable).toContain("timeline.nudgeLeft");
      expect(repeatable).toContain("timeline.nudgeRight");
    });
  });
});
