import { describe, expect, it } from "vitest";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { SETTING_IDS, settingIdsInSection } from "@/stores/settings-catalog";
import { countMatchesBySection, searchSettings } from "@/ui/settings/search-settings";

function search(query: string) {
  const result = searchSettings(query);
  if (!result) throw new Error(`expected results for "${query}"`);
  return result;
}

describe("searchSettings", () => {
  it("finds every snap setting in the timeline", () => {
    expect(search("snap").settings).toEqual(
      expect.arrayContaining(["timelineSnap", "vocalOnsetSnap", "timelineSnapThreshold", "snapPlayheadToPoints"]),
    );
  });

  it("requires every term to match", () => {
    expect(search("snap playhead").settings).toEqual(["snapPlayheadToPoints"]);
  });

  it("matches keywords that are not in the copy", () => {
    expect(search("mouse").settings).toEqual(["timelineHorizontalScroll"]);
  });

  it("matches the section label", () => {
    expect(search("confirmations").settings).toEqual(settingIdsInSection("confirmations"));
  });

  it("finds shortcuts by description", () => {
    expect(search("toggle snap").shortcuts.map((definition) => definition.id)).toContain("timeline.toggleSnap");
  });

  it("finds shortcuts by their bound keys", () => {
    const keys = getEffectiveKeysArray("global.settings").join(" ");
    expect(search(keys).shortcuts.map((definition) => definition.id)).toContain("global.settings");
  });

  describe("edge cases", () => {
    it("returns null for an empty or whitespace query", () => {
      expect(searchSettings("")).toBeNull();
      expect(searchSettings("   ")).toBeNull();
    });

    it("ignores case", () => {
      expect(search("SNAP").settings).toEqual(search("snap").settings);
    });

    it("treats regex characters literally", () => {
      expect(search("(magnet)").settings).toEqual(["timelineSnap"]);
    });

    it("returns empty lists, not null, when nothing matches", () => {
      expect(search("zzzqqq")).toEqual({ settings: [], shortcuts: [] });
    });

    it("does not throw on unicode", () => {
      expect(search("café").settings).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("keeps catalog order", () => {
      const settings = search("e").settings;
      expect(settings).toEqual(SETTING_IDS.filter((id) => settings.includes(id)));
    });
  });
});

describe("countMatchesBySection", () => {
  it("counts settings per section and shortcuts under shortcuts", () => {
    const result = search("snap");
    const counts = countMatchesBySection(result);
    expect(counts.timeline).toBe(result.settings.length);
    expect(counts.shortcuts).toBe(result.shortcuts.length);
    expect(counts.general).toBeUndefined();
  });
});
