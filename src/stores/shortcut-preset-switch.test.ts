import { afterEach, describe, expect, it } from "vitest";
import { detectConflicts, getEffectiveBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { clashingOverrides, overridesAfterSwitch } from "@/stores/shortcut-preset-switch";
import { SHORTCUT_PRESETS } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY, type ShortcutBinding } from "@/stores/shortcut-registry";

const TAP_ON_SPACE = { "sync.tap": { key: " " }, "global.toggleLoop": { key: "F9" } };
const UNRELATED = { "global.toggleLoop": { key: "F9" } };

afterEach(() => useShortcutBindingsStore.setState({ preset: "composer", overrides: {} }));

describe("clashingOverrides", () => {
  it("names a change that takes a key the preset uses", () => {
    expect(clashingOverrides("remastered", TAP_ON_SPACE)).toEqual(["sync.tap"]);
  });

  it("names nothing when the changes use free keys", () => {
    expect(clashingOverrides("remastered", UNRELATED)).toEqual([]);
  });

  it("names nothing on Composer, which moves no key", () => {
    expect(clashingOverrides("composer", TAP_ON_SPACE)).toEqual([]);
  });
});

describe("overridesAfterSwitch", () => {
  it("keeps changes on top of the preset, minus the ones that clash", () => {
    expect(overridesAfterSwitch("remastered", TAP_ON_SPACE, true)).toEqual(UNRELATED);
  });

  it("drops every change when the preset is used as it comes", () => {
    expect(overridesAfterSwitch("remastered", TAP_ON_SPACE, false)).toEqual({});
  });
});

describe("overridesAfterSwitch · invariants", () => {
  const fixtures: [string, Record<string, ShortcutBinding>][] = [
    ["tap on Space", TAP_ON_SPACE],
    ["unrelated", UNRELATED],
  ];

  it.each(SHORTCUT_PRESETS.flatMap(({ id }) => fixtures.map(([name, overrides]) => [id, name, overrides] as const)))(
    "switching to %s with %s changes kept leaves no clash",
    (preset, _, overrides) => {
      useShortcutBindingsStore.setState({ preset, overrides: overridesAfterSwitch(preset, overrides, true) });
      const clashes = SHORTCUT_REGISTRY.flatMap((def) =>
        detectConflicts(def.id, getEffectiveBinding(def.id)).map((other) => `${def.id} <> ${other.id}`),
      );
      expect(clashes).toEqual([]);
    },
  );
});
