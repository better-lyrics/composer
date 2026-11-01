import { describe, expect, it } from "vitest";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { historyShortcutAction } from "@/utils/history-shortcut";
import { isMac } from "@/utils/platform";

// -- Helpers ------------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };
const OTHER_COMMAND_KEY = { metaKey: !isMac, ctrlKey: isMac };
const UNBOUND = { key: "" };

function keydown(init: KeyboardEventInit, target?: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (target) Object.defineProperty(event, "target", { value: target });
  return event;
}

// -- Tests --------------------------------------------------------------------

describe("historyShortcutAction", () => {
  describe("happy paths", () => {
    it("reads Mod+Z as undo and Mod+Shift+Z as redo", () => {
      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ", ...MOD }))).toBe("undo");
      expect(historyShortcutAction(keydown({ key: "Z", code: "KeyZ", ...MOD, shiftKey: true }))).toBe("redo");
    });

    it("follows remapped bindings", () => {
      useShortcutBindingsStore.setState({
        overrides: { "global.undo": { key: "b", mod: true }, "global.redo": { key: "r", mod: true, alt: true } },
      });

      expect(historyShortcutAction(keydown({ key: "b", code: "KeyB", ...MOD }))).toBe("undo");
      expect(historyShortcutAction(keydown({ key: "r", code: "KeyR", ...MOD, altKey: true }))).toBe("redo");
    });

    it("returns the action for held repeats so handlers can consume them", () => {
      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ", ...MOD, repeat: true }))).toBe("undo");
    });
  });

  describe("keys that worked before undo and redo were remappable", () => {
    it("undoes and redoes with either Ctrl or Cmd held", () => {
      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ", ...OTHER_COMMAND_KEY }))).toBe("undo");
      expect(historyShortcutAction(keydown({ key: "Z", code: "KeyZ", ...OTHER_COMMAND_KEY, shiftKey: true }))).toBe(
        "redo",
      );
    });

    it("undoes on the physical Z key under a non-Latin layout", () => {
      expect(historyShortcutAction(keydown({ key: "я", code: "KeyZ", ...MOD }))).toBe("undo");
      expect(historyShortcutAction(keydown({ key: "Я", code: "KeyZ", ...MOD, shiftKey: true }))).toBe("redo");
    });

    it("redoes on Y with either command key only where Y redid before", () => {
      const commandY = keydown({ key: "y", code: "KeyY", ...OTHER_COMMAND_KEY });

      expect(historyShortcutAction(commandY, { redoOnY: true })).toBe("redo");
      expect(historyShortcutAction(commandY)).toBeNull();
    });

    it("keeps Mod+Z undoing after undo is remapped", () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b", mod: true } } });

      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ", ...MOD }))).toBe("undo");
    });

    it("yields Mod+Z to a global shortcut the user bound to it", () => {
      useShortcutBindingsStore.setState({
        overrides: { "global.undo": UNBOUND, "global.goToSync": { key: "z", mod: true } },
      });

      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ", ...MOD }))).toBeNull();
    });

    it("yields Mod+Z to a shortcut bound in the same scope only", () => {
      useShortcutBindingsStore.setState({
        overrides: { "global.undo": UNBOUND, "timeline.toggleFollow": { key: "z", mod: true } },
      });
      const event = keydown({ key: "z", code: "KeyZ", ...MOD });

      expect(historyShortcutAction(event, { scope: "timeline" })).toBeNull();
      expect(historyShortcutAction(event, { scope: "sync" })).toBe("undo");
    });
  });

  describe("edge cases", () => {
    it("ignores plain Z", () => {
      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ" }))).toBeNull();
    });

    it("leaves a plain-key binding to text fields", () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b" } } });
      const input = document.createElement("input");
      const textarea = document.createElement("textarea");

      expect(historyShortcutAction(keydown({ key: "b", code: "KeyB" }, input))).toBeNull();
      expect(historyShortcutAction(keydown({ key: "b", code: "KeyB" }, textarea))).toBeNull();
      expect(historyShortcutAction(keydown({ key: "b", code: "KeyB" }))).toBe("undo");
    });

    it("keeps command-key bindings working inside text fields", () => {
      const input = document.createElement("input");

      expect(historyShortcutAction(keydown({ key: "z", code: "KeyZ", ...MOD }, input))).toBe("undo");
    });
  });
});
