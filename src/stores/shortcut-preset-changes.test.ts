import { describe, expect, it } from "vitest";
import { ownChanges, presetChanges } from "@/stores/shortcut-preset-changes";
import { SHORTCUT_PRESETS } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY } from "@/stores/shortcut-registry";

describe("presetChanges", () => {
  it("lists nothing for Composer", () => {
    expect(presetChanges("composer")).toEqual([]);
  });

  it("lists the three keys Editor moves, from Composer's key to the preset's", () => {
    expect(presetChanges("editor")).toEqual([
      { id: "global.playPause", description: expect.any(String), from: { key: "Enter" }, to: { key: " " } },
      { id: "sync.tap", description: expect.any(String), from: { key: " " }, to: { key: "Enter" } },
      { id: "timeline.jumpToPlayhead", description: expect.any(String), from: { key: " " }, to: { key: "Enter" } },
    ]);
  });

  it("lists every key Remastered moves", () => {
    expect(presetChanges("remastered")).toHaveLength(11);
  });
});

describe("ownChanges", () => {
  it("compares a change with the preset's key, not Composer's", () => {
    expect(ownChanges("editor", { "global.playPause": { key: "p" } })).toEqual([
      { id: "global.playPause", description: expect.any(String), from: { key: " " }, to: { key: "p" } },
    ]);
  });

  it("falls back to Composer's key for an action the preset leaves alone", () => {
    expect(ownChanges("editor", { "global.toggleLoop": { key: "F9" } })).toEqual([
      { id: "global.toggleLoop", description: expect.any(String), from: { key: "l", shift: true }, to: { key: "F9" } },
    ]);
  });
});

describe("change lists · invariants", () => {
  const order = SHORTCUT_REGISTRY.map(({ id }) => id);

  it.each(SHORTCUT_PRESETS.map(({ id }) => [id] as const))("%s lists changes in registry order", (id) => {
    const ids = presetChanges(id).map((change) => change.id);
    expect(ids).toEqual(order.filter((shortcutId) => ids.includes(shortcutId)));
  });
});
