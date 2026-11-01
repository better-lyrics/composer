import { ownChanges, presetChanges } from "@/stores/shortcut-preset-changes";
import { SHORTCUT_PRESETS } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY } from "@/stores/shortcut-registry";
import { describe, expect, it } from "vitest";

describe("presetChanges", () => {
  it("lists nothing for Composer", () => {
    expect(presetChanges("composer")).toEqual([]);
  });

  it("lists the three keys Editor moves, from Composer's key to the preset's", () => {
    expect(presetChanges("editor")).toEqual([
      { ids: ["global.playPause"], label: expect.any(String), from: [{ key: "Enter" }], to: [{ key: " " }] },
      { ids: ["sync.tap"], label: expect.any(String), from: [{ key: " " }], to: [{ key: "Enter" }] },
      { ids: ["timeline.jumpToPlayhead"], label: expect.any(String), from: [{ key: " " }], to: [{ key: "Enter" }] },
    ]);
  });

  it("pairs back and forward, and Sync and Timeline nudges, into one row", () => {
    expect(presetChanges("remastered").map(({ label }) => label)).toEqual([
      expect.any(String),
      "Seek",
      "Fine seek",
      expect.any(String),
      "Nudge words",
      expect.any(String),
    ]);
    const nudge = presetChanges("remastered").find(({ label }) => label === "Nudge words");
    expect(nudge).toMatchObject({
      from: [{ key: "ArrowLeft" }, { key: "ArrowRight" }],
      to: [{ key: "-" }, { key: "=" }],
    });
  });
});

describe("ownChanges", () => {
  it("compares a change with the preset's key, not Composer's", () => {
    expect(ownChanges("editor", { "global.playPause": { key: "p" } })).toEqual([
      { ids: ["global.playPause"], label: expect.any(String), from: [{ key: " " }], to: [{ key: "p" }] },
    ]);
  });

  it("falls back to Composer's key for an action the preset leaves alone", () => {
    expect(ownChanges("editor", { "global.toggleLoop": { key: "F9" } })).toEqual([
      {
        ids: ["global.toggleLoop"],
        label: expect.any(String),
        from: [{ key: "l", shift: true }],
        to: [{ key: "F9" }],
      },
    ]);
  });
});

describe("change lists · invariants", () => {
  const order = SHORTCUT_REGISTRY.map(({ id }) => id);

  it.each(SHORTCUT_PRESETS.map(({ id }) => [id] as const))("%s lists every changed id once", (id) => {
    const ids = presetChanges(id).flatMap((change) => change.ids);
    expect(ids.toSorted()).toEqual(Object.keys(SHORTCUT_PRESETS.find((p) => p.id === id)?.bindings ?? {}).toSorted());
    expect(ids.map((shortcutId) => order.indexOf(shortcutId)).every((index) => index >= 0)).toBe(true);
  });
});
