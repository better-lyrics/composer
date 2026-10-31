import { beforeEach, describe, expect, it } from "vitest";
import { detectConflicts, getEffectiveBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { presetBinding, SHORTCUT_PRESETS } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY } from "@/stores/shortcut-registry";

const knownIds = new Set(SHORTCUT_REGISTRY.map(({ id }) => id));

describe("shortcut presets · invariants", () => {
  beforeEach(() => useShortcutBindingsStore.setState({ overrides: {} }));

  it.each(SHORTCUT_PRESETS.map((preset) => [preset.id, preset] as const))(
    "%s lists only known shortcut ids",
    (_, preset) => {
      expect(Object.keys(preset.bindings).filter((id) => !knownIds.has(id))).toEqual([]);
    },
  );

  it.each(SHORTCUT_PRESETS.map((preset) => [preset.id] as const))("%s has no clashes and no unbound action", (id) => {
    useShortcutBindingsStore.setState({ preset: id, overrides: {} });
    const clashes = SHORTCUT_REGISTRY.flatMap((def) =>
      detectConflicts(def.id, getEffectiveBinding(def.id)).map((other) => `${def.id} <> ${other.id}`),
    );
    const unbound = SHORTCUT_REGISTRY.filter((def) => getEffectiveBinding(def.id).key === "").map(({ id }) => id);
    expect({ clashes, unbound }).toEqual({ clashes: [], unbound: [] });
  });

  it("composer changes nothing", () => {
    expect(presetBinding("composer", "global.playPause")).toBeUndefined();
  });
});
