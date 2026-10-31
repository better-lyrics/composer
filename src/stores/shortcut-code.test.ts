import { decodeShortcutCode, encodeShortcutCode } from "@/stores/shortcut-code";
import { SHORTCUT_PRESETS } from "@/stores/shortcut-presets";
import { describe, expect, it } from "vitest";

const MIXED = {
  "global.toggleLoop": { key: "" },
  "timeline.toggleFollow": { key: ":" },
  "sync.tap": { key: ";", shift: true },
  "global.playPause": { key: "F7" },
  "global.seekBackward": { key: "ArrowLeft", alt: true, mod: true },
};

describe("shortcut codes", () => {
  it.each(SHORTCUT_PRESETS.map(({ id }) => [id] as const))("round trips %s with changed keys", (preset) => {
    expect(decodeShortcutCode(encodeShortcutCode(preset, MIXED))).toEqual({ preset, overrides: MIXED });
  });

  it("writes a preset with no changes as an empty tail", () => {
    expect(encodeShortcutCode("editor", {})).toBe("csk1:editor:8:");
    expect(decodeShortcutCode("csk1:editor:8:")).toEqual({ preset: "editor", overrides: {} });
  });

  it("reads a code with spaces around it", () => {
    expect(decodeShortcutCode("  csk1:osu:8:  \n")).toEqual({ preset: "osu", overrides: {} });
  });

  it("migrates a code from an older version like saved changes", () => {
    const code = "csk1:composer:6:timeline.toggleFollow=shift+alt+%3C";

    expect(decodeShortcutCode(code).overrides).toEqual({
      "timeline.toggleFollow": { key: "<", shift: true, alt: true },
      "global.seekBackwardFine": { key: "" },
    });
  });

  describe("error paths", () => {
    it.each([
      "",
      "ctm1:dark:x:aa",
      "csk1:",
      "csk1:editor",
      "csk1:editor:x:",
      "csk1:editor:8:sync.tap",
      "csk1:editor:8:sync.tap=hyper+a",
      "csk1:editor:8:sync.tap=%E0%A4%A",
    ])("rejects %j as not a code", (code) => {
      expect(() => decodeShortcutCode(code)).toThrow("That isn't a shortcuts code. It should start with csk1:.");
    });

    it("rejects a preset Composer doesn't know", () => {
      expect(() => decodeShortcutCode("csk1:vim:8:")).toThrow("This code uses a preset Composer doesn't know.");
    });

    it("refuses a code that puts two actions on one key", () => {
      expect(() => decodeShortcutCode("csk1:editor:8:global.toggleLoop=%20")).toThrow(
        "This code puts Play / Pause and Loop the playback range on the same key.",
      );
    });

    it("refuses a code from a newer Composer", () => {
      expect(() => decodeShortcutCode("csk1:composer:99:")).toThrow(
        "This code comes from a newer Composer. Update the app and try again.",
      );
    });

    it("rejects a negative version as not a code", () => {
      expect(() => decodeShortcutCode("csk1:composer:-1:")).toThrow(
        "That isn't a shortcuts code. It should start with csk1:.",
      );
    });

    it("names a shortcut Composer doesn't know", () => {
      expect(() => decodeShortcutCode("csk1:editor:8:global.fly=f")).toThrow(
        "This code has a shortcut Composer doesn't know: global.fly.",
      );
    });
  });
});
