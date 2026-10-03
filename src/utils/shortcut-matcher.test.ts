import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { SHORTCUT_DEFINITIONS } from "@/stores/shortcut-definitions";
import { bindingFromKeyboardEvent, findMatchingShortcut } from "@/utils/shortcut-matcher";
import { describe, expect, it } from "vitest";

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

    it("matches repeated sync seeks", () => {
      expect(findMatchingShortcut(keydown({ key: "ArrowLeft", repeat: true }), "sync")).toBe("sync.seekBackward");
      expect(findMatchingShortcut(keydown({ key: "ArrowRight", repeat: true }), "sync")).toBe("sync.seekForward");
    });

    it("can identify a non-repeatable binding so a capture handler can consume its repeats", () => {
      const event = keydown({ key: "ArrowLeft", shiftKey: true, repeat: true });
      expect(findMatchingShortcut(event, "sync")).toBeNull();
      expect(findMatchingShortcut(event, "sync", { includeRepeats: true })).toBe("sync.nudgeLeft");
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
    it("only nudges, jumps, and seeks opt into auto-repeat", () => {
      const repeatable = SHORTCUT_DEFINITIONS.filter((definition) => definition.repeatable).map(({ id }) => id);
      for (const id of repeatable) {
        expect(id).toMatch(/\.(nudge|jump|seek)/);
      }
      expect(repeatable).toContain("timeline.nudgeLeft");
      expect(repeatable).toContain("timeline.nudgeRight");
    });
  });
});

describe("bindingFromKeyboardEvent", () => {
  describe("happy paths", () => {
    it("records a plain key", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "p", code: "KeyP" }))).toEqual({ key: "p" });
    });

    it("records Shift with a lowercase key", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "P", code: "KeyP", shiftKey: true }))).toEqual({
        key: "p",
        shift: true,
      });
    });

    it("records a named key", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "ArrowLeft", code: "ArrowLeft" }))).toEqual({ key: "ArrowLeft" });
    });

    it("records a function key", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "F5", code: "F5" }))).toEqual({ key: "F5" });
    });

    it("records Space as a space", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: " ", code: "Space" }))).toEqual({ key: " " });
    });
  });

  describe("regressions", () => {
    it("regression: macOS Alt+E records the physical key, not the glyph", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "\u00b4", code: "KeyE", altKey: true }))).toEqual({
        key: "e",
        alt: true,
      });
    });

    it("regression: a recorded macOS Alt binding matches the same key press", () => {
      const event = keydown({ key: "\u00b4", code: "KeyE", altKey: true });
      const binding = bindingFromKeyboardEvent(event);
      if (!binding) throw new Error("expected a binding");
      useShortcutBindingsStore.setState({ overrides: { "timeline.toggleFollow": binding } });
      expect(findMatchingShortcut(event, "timeline")).toBe("timeline.toggleFollow");
    });
  });

  describe("edge cases", () => {
    it.each(["Dead", "Unidentified", "Process", "Compose"])("ignores the non-bindable key %s", (key) => {
      expect(bindingFromKeyboardEvent(keydown({ key }))).toBeNull();
    });

    it.each(["Shift", "Alt", "Control", "Meta", "AltGraph", "CapsLock"])("ignores a bare %s", (key) => {
      expect(bindingFromKeyboardEvent(keydown({ key }))).toBeNull();
    });
  });
});
