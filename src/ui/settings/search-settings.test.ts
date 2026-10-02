import { DEFAULTS, type SettingsState } from "@/stores/settings";
import { SETTING_IDS, settingIdsInSection } from "@/stores/settings-catalog";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { countMatchesBySection, searchSettings } from "@/ui/settings/search-settings";
import { describe, expect, it } from "vitest";

function search(query: string, state: SettingsState = DEFAULTS) {
  const result = searchSettings(query, state);
  if (!result) throw new Error(`expected results for "${query}"`);
  return result;
}

describe("searchSettings", () => {
  it("finds every snap setting in the timeline", () => {
    expect(search("snap").settings).toEqual(
      expect.arrayContaining(["timelineSnap", "vocalOnsetSnap", "timelineSnapThreshold", "snapPlayheadToPoints"]),
    );
  });

  it("finds the shared group timing setting by a keyword not in its copy", () => {
    expect(search("chorus").settings).toContain("shareTimingInNewGroups");
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

  it("finds the tour and settings reset rows", () => {
    expect(search("onboarding").settings).toEqual(["resetTour"]);
    expect(search("reset to defaults").settings).toContain("resetAllSettings");
  });

  it("finds the storage protection row by a keyword not in its copy", () => {
    expect(search("persist").settings).toEqual(["storageProtection"]);
  });

  it("finds the keep YouTube audio row by a keyword not in its copy", () => {
    expect(search("cache").settings).toEqual(["keepYouTubeAudio"]);
  });

  it("finds the audio by project row by a keyword not in its copy", () => {
    expect(search("stems").settings).toContain("projectAudioList");
  });

  it("finds the delete all projects row by a keyword not in its copy", () => {
    expect(search("erase").settings).toEqual(["deleteAllProjects"]);
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
      expect(searchSettings("", DEFAULTS)).toBeNull();
      expect(searchSettings("   ", DEFAULTS)).toBeNull();
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

describe("searchSettings visibility", () => {
  it("drops a hidden setting from results and its section badge, restores both once visible (positive control)", () => {
    const off = search("quota limit", { ...DEFAULTS, smartCleanup: false });
    expect(off.settings).toEqual([]);
    expect(countMatchesBySection(off).storage).toBeUndefined();

    const on = search("quota limit", { ...DEFAULTS, smartCleanup: true });
    expect(on.settings).toEqual(["storageLimit"]);
    expect(countMatchesBySection(on).storage).toBe(1);
  });

  describe("edge cases", () => {
    it("still finds a sibling row in the same section once the hidden one is filtered out", () => {
      const off = search("storage", { ...DEFAULTS, smartCleanup: false });
      expect(off.settings).not.toContain("storageLimit");
      expect(off.settings).toContain("storageProtection");
    });
  });
});

describe("searchSettings computed description", () => {
  it("matches a word only present in the current computed description", () => {
    expect(search("offline", DEFAULTS).settings).toEqual([]);
    expect(search("offline", { ...DEFAULTS, keepYouTubeAudio: "always" }).settings).toEqual(["keepYouTubeAudio"]);
  });
});
