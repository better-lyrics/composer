import { afterEach, describe, expect, it } from "vitest";
import { getEffectiveBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { presetForOverrides } from "@/stores/shortcut-preset-match";
import { SHORTCUT_PRESETS, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY, type ShortcutBinding } from "@/stores/shortcut-registry";

const SWAPPER = {
  "global.playPause": { key: " " },
  "sync.tap": { key: "Enter" },
  "timeline.jumpToPlayhead": { key: "" },
};
const CUSTOM = { "global.toggleLoop": { key: "l" } };
const ARROW_SEEK_ONLY = { "global.seekBackward": { key: "ArrowLeft" } };
const SPACE_ENTER_ONLY = { "global.playPause": { key: " " }, "sync.tap": { key: "Enter" } };

function effectiveLayout(preset: ShortcutPresetId, overrides: Record<string, ShortcutBinding>) {
  useShortcutBindingsStore.setState({ preset, overrides });
  return Object.fromEntries(SHORTCUT_REGISTRY.map(({ id }) => [id, getEffectiveBinding(id)]));
}

afterEach(() => useShortcutBindingsStore.setState({ preset: "composer", overrides: {} }));

describe("presetForOverrides", () => {
  it("keeps Composer when nothing was changed", () => {
    expect(presetForOverrides({})).toEqual({ preset: "composer", overrides: {} });
  });

  it("picks Editor for a hand swap of Space and Enter and keeps the unbound jump as the user's own change", () => {
    expect(presetForOverrides(SWAPPER)).toEqual({
      preset: "editor",
      overrides: { "timeline.jumpToPlayhead": { key: "" } },
    });
  });

  it("stays on Composer when no preset matches", () => {
    expect(presetForOverrides(CUSTOM)).toEqual({ preset: "composer", overrides: CUSTOM });
  });

  it("stays on Composer when a preset would leave more changes than it removes", () => {
    expect(presetForOverrides(ARROW_SEEK_ONLY)).toEqual({ preset: "composer", overrides: ARROW_SEEK_ONLY });
  });

  it.each(SHORTCUT_PRESETS.filter(({ id }) => id !== "composer").map(({ id, bindings }) => [id, bindings] as const))(
    "maps a hand-built %s layout to that preset with no own changes",
    (id, bindings) => {
      expect(presetForOverrides({ ...bindings })).toEqual({ preset: id, overrides: {} });
    },
  );

  describe("edge cases", () => {
    it("pins a key the preset would move when the user never changed it", () => {
      const result = presetForOverrides(SPACE_ENTER_ONLY);
      expect(result.preset).toBe("editor");
      expect(result.overrides["timeline.jumpToPlayhead"]).toEqual(
        SHORTCUT_REGISTRY.find(({ id }) => id === "timeline.jumpToPlayhead")?.defaultBinding,
      );
    });
  });
});

describe("presetForOverrides · invariants", () => {
  const fixtures: [string, Record<string, ShortcutBinding>][] = [
    ["swapper", SWAPPER],
    ["custom", CUSTOM],
    ["arrow seek only", ARROW_SEEK_ONLY],
    ["Space and Enter only", SPACE_ENTER_ONLY],
    ...SHORTCUT_PRESETS.map(({ id, bindings }): [string, Record<string, ShortcutBinding>] => [
      `hand-built ${id}`,
      { ...bindings },
    ]),
  ];

  it.each(fixtures)("never changes an effective binding (%s)", (_, overrides) => {
    const before = effectiveLayout("composer", overrides);
    const { preset, overrides: kept } = presetForOverrides(overrides);
    expect(effectiveLayout(preset, kept)).toEqual(before);
  });
});
