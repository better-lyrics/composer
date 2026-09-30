import { describe, expect, it } from "vitest";
import { formatKey, formatShortcut } from "@/utils/format-key";
import { isMac } from "@/utils/platform";

describe("formatKey", () => {
  it("maps platform-independent keys to their symbols", () => {
    expect(formatKey("Shift")).toBe("⇧");
    expect(formatKey("Enter")).toBe("↵");
    expect(formatKey("ArrowLeft")).toBe("←");
    expect(formatKey("ArrowRight")).toBe("→");
    expect(formatKey("ArrowUp")).toBe("↑");
    expect(formatKey("ArrowDown")).toBe("↓");
    expect(formatKey("Space")).toBe("Space");
    expect(formatKey("Backspace")).toBe("⌫");
    expect(formatKey("Escape")).toBe("Esc");
  });

  it("maps modifier keys according to the host platform", () => {
    expect(formatKey("Mod")).toBe(isMac ? "⌘" : "Ctrl");
    expect(formatKey("Meta")).toBe(isMac ? "⌘" : "Meta");
    expect(formatKey("Ctrl")).toBe(isMac ? "⌃" : "Ctrl");
    expect(formatKey("Alt")).toBe(isMac ? "⌥" : "Alt");
  });

  describe("edge cases", () => {
    it("passes unmapped keys through unchanged", () => {
      expect(formatKey("A")).toBe("A");
      expect(formatKey("F2")).toBe("F2");
      expect(formatKey("[")).toBe("[");
    });

    it("returns an empty string unchanged", () => {
      expect(formatKey("")).toBe("");
    });

    it("is case-sensitive and does not coerce lowercase modifier names", () => {
      expect(formatKey("shift")).toBe("shift");
      expect(formatKey("enter")).toBe("enter");
    });
  });
});

describe("formatShortcut", () => {
  it("joins the formatted keys the way the host platform writes shortcuts", () => {
    expect(formatShortcut(["Mod", "O"])).toBe(isMac ? "⌘O" : "Ctrl+O");
    expect(formatShortcut(["Mod", "Alt", "N"])).toBe(isMac ? "⌘⌥N" : "Ctrl+Alt+N");
  });

  describe("edge cases", () => {
    it("formats a single key and an unbound shortcut", () => {
      expect(formatShortcut(["F2"])).toBe("F2");
      expect(formatShortcut([])).toBe("");
    });
  });
});
