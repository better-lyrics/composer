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

const MOD = { metaKey: isMac, ctrlKey: !isMac };

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
    it("regression: a global shortcut saved on Mod+Z still wins over the default undo", () => {
      useShortcutBindingsStore.setState({ overrides: { "global.goToEdit": { key: "z", mod: true } } });

      expect(findMatchingShortcut(keydown({ key: "z", ...MOD }), "global")).toBe("global.goToEdit");
    });

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
        expect(id).toMatch(/\.(nudge|jump|seek)/);
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

  describe("undo and redo", () => {
    it("matches a key press to the shortcut's effective binding", () => {
      expect(matchesShortcutBinding(keydown({ key: "z", ...MOD }), "global.undo")).toBe(true);
    });

    it("matches a held repeat that findMatchingShortcut ignores, so handlers can consume it", () => {
      const held = keydown({ key: "z", ...MOD, repeat: true });

      expect(matchesShortcutBinding(held, "global.undo")).toBe(true);
      expect(findMatchingShortcut(held, "global")).toBeNull();
    });

    it("follows a remapped binding instead of the default", () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b", mod: true } } });

      expect(matchesShortcutBinding(keydown({ key: "b", ...MOD }), "global.undo")).toBe(true);
      expect(matchesShortcutBinding(keydown({ key: "z", ...MOD }), "global.undo")).toBe(false);
    });

    describe("edge cases", () => {
      it("never matches an unbound shortcut", () => {
        useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "" } } });

        expect(matchesShortcutBinding(keydown({ key: "z", ...MOD }), "global.undo")).toBe(false);
      });

      it("tells undo from redo by Shift", () => {
        const redo = keydown({ key: "Z", ...MOD, shiftKey: true });

        expect(matchesShortcutBinding(redo, "global.undo")).toBe(false);
        expect(matchesShortcutBinding(redo, "global.redo")).toBe(true);
      });
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

describe("keyboard layouts", () => {
  describe("happy paths", () => {
    it("matches a letter shortcut typed on a Russian layout by its physical key", () => {
      expect(findMatchingShortcut(keydown({ key: "р", code: "KeyR" }), "timeline")).toBe("timeline.toggleRollingEdit");
    });

    it("matches a shifted letter shortcut on a Russian layout", () => {
      expect(findMatchingShortcut(keydown({ key: "У", code: "KeyE", shiftKey: true }), "timeline")).toBe(
        "timeline.toggleExplicit",
      );
    });

    it("matches undo on a Russian layout", () => {
      expect(matchesShortcutBinding(keydown({ key: "я", code: "KeyZ", ...MOD }), "global.undo")).toBe(true);
    });

    it("records the Latin key for a Cyrillic letter", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "Р", code: "KeyH", shiftKey: true }))).toEqual({
        key: "h",
        shift: true,
      });
    });

    it("records punctuation from a key that carries a Cyrillic letter", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "х", code: "BracketLeft" }))).toEqual({ key: "[" });
    });
  });

  describe("edge cases", () => {
    it("uses the US shifted character for shifted punctuation on a Cyrillic key", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "Х", code: "BracketLeft", shiftKey: true }))).toEqual({
        key: "{",
        shift: true,
      });
    });

    it("keeps a non-letter glyph such as the numero sign", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "№", code: "Digit3", shiftKey: true }))).toEqual({
        key: "№",
        shift: true,
      });
    });

    it("keeps the printed key on a Latin layout such as AZERTY", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "a", code: "KeyQ" }))).toEqual({ key: "a" });
    });

    it("keeps accented Latin letters such as German ü", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "ü", code: "BracketLeft" }))).toEqual({ key: "ü" });
    });

    it("regression: a saved accented Latin binding still matches", () => {
      useShortcutBindingsStore.setState({ overrides: { "global.help": { key: "é" } } });
      expect(matchesShortcutBinding(keydown({ key: "é", code: "Digit2" }), "global.help")).toBe(true);
    });

    it("keeps a non-ASCII glyph when the physical key has no US mapping", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "ß", code: "IntlBackslash" }))).toEqual({ key: "ß" });
    });

    it("reads the shifted character when the browser reports the unshifted one with Mod+Shift held", () => {
      const event = keydown({ key: ",", code: "Comma", shiftKey: true, ...MOD });
      expect(findMatchingShortcut(event, "global")).toBe("global.seekBackwardWhileTyping");
      expect(bindingFromKeyboardEvent(event)).toMatchObject({ key: "<", shift: true, mod: true });
    });

    it("regression: still matches a Mod+Shift binding saved with the unshifted character", () => {
      useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: ".", shift: true, mod: true } } });
      const press = keydown({ key: ".", code: "Period", shiftKey: true, ...MOD });
      expect(matchesShortcutBinding(press, "global.settings")).toBe(true);
    });

    it("keeps named keys on any layout", () => {
      expect(bindingFromKeyboardEvent(keydown({ key: "ArrowLeft", code: "ArrowLeft" }))).toEqual({ key: "ArrowLeft" });
    });
  });
});
