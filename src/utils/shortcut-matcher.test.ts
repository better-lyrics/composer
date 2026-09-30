import { assignBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { SHORTCUT_DEFINITIONS } from "@/stores/shortcut-definitions";
import { isMac } from "@/utils/platform";
import {
  bindingFromKeyboardEvent,
  findMatchingShortcut,
  isReservedBrowserShortcut,
  matchesShortcutBinding,
} from "@/utils/shortcut-matcher";
import { describe, expect, it } from "vitest";

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { bubbles: true, ...init });
}

describe("findMatchingShortcut", () => {
  describe("happy paths", () => {
    it("matches a first keydown to its shortcut", () => {
      expect(findMatchingShortcut(keydown({ key: "r" }), "timeline")).toBe("timeline.toggleRollingEdit");
    });

    it("matches Ctrl+Alt+N to the new project shortcut", () => {
      const event = keydown({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
      expect(findMatchingShortcut(event, "global")).toBe("global.newProject");
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

    it("regression: AltGr+N does not trigger new project even though it reports ctrlKey and altKey", () => {
      const event = keydown({
        key: "\u0144",
        code: "KeyN",
        ctrlKey: true,
        altKey: true,
        modifierAltGraph: true,
      } as KeyboardEventInit);
      expect(findMatchingShortcut(event, "global")).toBeNull();
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

describe("matchesShortcutBinding", () => {
  const modS = (init: KeyboardEventInit = {}) =>
    keydown({ key: "s", code: "KeyS", metaKey: isMac, ctrlKey: !isMac, ...init });

  it("matches the shortcut's binding", () => {
    expect(matchesShortcutBinding(modS(), "global.saveNow")).toBe(true);
  });

  it("matches held-key repeats that findMatchingShortcut ignores", () => {
    expect(matchesShortcutBinding(modS({ repeat: true }), "global.saveNow")).toBe(true);
    expect(findMatchingShortcut(modS({ repeat: true }), "global")).toBeNull();
  });

  describe("edge cases", () => {
    it("does not match other keys or a missing modifier", () => {
      expect(matchesShortcutBinding(keydown({ key: "s", code: "KeyS" }), "global.saveNow")).toBe(false);
      expect(matchesShortcutBinding(modS({ key: "d", code: "KeyD" }), "global.saveNow")).toBe(false);
    });

    it("follows a remapped binding", () => {
      assignBinding("global.saveNow", { key: "k", mod: true, shift: true });
      expect(matchesShortcutBinding(modS(), "global.saveNow")).toBe(false);
      expect(matchesShortcutBinding(modS({ key: "k", code: "KeyK", shiftKey: true }), "global.saveNow")).toBe(true);
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

describe("isReservedBrowserShortcut", () => {
  it("flags a browser shortcut the app does not own", () => {
    expect(isReservedBrowserShortcut({ key: "t", mod: true })).toBe(true);
  });

  describe("regressions", () => {
    it("regression: never flags Mod+S, which the app owns for saving", () => {
      expect(isReservedBrowserShortcut({ key: "s", mod: true })).toBe(false);
    });
  });
});
