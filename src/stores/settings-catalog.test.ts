import { DEFAULTS } from "@/stores/settings";
import {
  SETTINGS_SECTIONS,
  SETTING_IDS,
  isSettingVisible,
  readSettingOn,
  sectionLabel,
  settingDescription,
  settingEntry,
  settingIdsInSection,
  settingKeyOf,
  visibleSettingIds,
} from "@/stores/settings-catalog";
import { describe, expect, it } from "vitest";

const SECTION_ORDER = SETTINGS_SECTIONS.map((section) => section.id);

describe("SETTINGS_CATALOG", () => {
  it("places every entry in a known section", () => {
    for (const id of SETTING_IDS) expect(SECTION_ORDER).toContain(settingEntry(id).section);
  });

  it("lists entries grouped in section order", () => {
    const sectionIndexes = SETTING_IDS.map((id) => SECTION_ORDER.indexOf(settingEntry(id).section));
    expect(sectionIndexes).toEqual(sectionIndexes.toSorted((a, b) => a - b));
  });

  it("points every store key at a real setting", () => {
    for (const id of SETTING_IDS) {
      const key = settingEntry(id).settingKey;
      if (key !== undefined) expect(Object.hasOwn(DEFAULTS, key)).toBe(true);
    }
  });

  describe("copy", () => {
    it("has unique labels so a link is never ambiguous", () => {
      const labels = SETTING_IDS.map((id) => settingEntry(id).label);
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("has trimmed, non-empty labels and descriptions ending in a period", () => {
      for (const id of SETTING_IDS) {
        const { label } = settingEntry(id);
        const description = settingDescription(id, DEFAULTS);
        expect(label.length).toBeGreaterThan(0);
        expect(label).toBe(label.trim());
        expect(description).toBe(description.trim());
        expect(description.endsWith(".")).toBe(true);
      }
    });

    it("uses no em or en dashes", () => {
      for (const id of SETTING_IDS) {
        const { label, keywords = [] } = settingEntry(id);
        const description = settingDescription(id, DEFAULTS);
        expect([label, description, ...keywords].join(" ")).not.toMatch(/[\u2013\u2014]/);
      }
    });
  });

  describe("regressions", () => {
    it("regression: lists the group deletion prompt under Confirmations", () => {
      expect(settingIdsInSection("confirmations")).toContain("confirmGroupDissolution");
    });
  });
});

describe("settingIdsInSection", () => {
  it("covers every id exactly once across sections", () => {
    const all = SECTION_ORDER.flatMap((section) => settingIdsInSection(section));
    expect(all).toEqual([...SETTING_IDS]);
  });

  it("returns nothing for shortcuts, which come from the shortcut registry", () => {
    expect(settingIdsInSection("shortcuts")).toEqual([]);
  });
});

describe("sectionLabel", () => {
  it("returns the display label", () => {
    expect(sectionLabel("sync")).toBe("Sync & Timing");
  });
});

describe("settingKeyOf", () => {
  it("returns the store key of a store-backed setting", () => {
    expect(settingKeyOf("followPlayhead")).toBe("followPlayhead");
  });

  describe("error paths", () => {
    it("throws for a setting with no store key", () => {
      expect(() => settingKeyOf("theme")).toThrow(/theme/);
    });
  });
});

describe("readSettingOn", () => {
  it("reads a boolean store value", () => {
    expect(readSettingOn("followPlayhead", { ...DEFAULTS, followPlayhead: false })).toBe(false);
    expect(readSettingOn("followPlayhead", { ...DEFAULTS, followPlayhead: true })).toBe(true);
  });

  it("uses a custom reader when one is declared", () => {
    const state = { ...DEFAULTS, experiments: { ...DEFAULTS.experiments, youtubeBridge: true } };
    expect(readSettingOn("youtubeBridge", state)).toBe(true);
  });

  describe("edge cases", () => {
    it("returns null for a number setting", () => {
      expect(readSettingOn("nudgeAmount", DEFAULTS)).toBeNull();
    });

    it("returns null for a setting with no store key", () => {
      expect(readSettingOn("theme", DEFAULTS)).toBeNull();
    });
  });
});

describe("settingDescription", () => {
  it("returns the static description for a setting with no override", () => {
    expect(settingDescription("followPlayhead", DEFAULTS)).toBe(
      "Auto-scroll the timeline to keep the playhead visible.",
    );
  });

  it("computes the description from state when the entry declares one", () => {
    expect(settingDescription("keepYouTubeAudio", { ...DEFAULTS, keepYouTubeAudio: "always" })).toBe(
      "YouTube audio is kept, so projects open offline. Cleanup can still remove it.",
    );
  });

  describe("edge cases", () => {
    it("reacts to the bridge flag through the same override", () => {
      const bridgeOn = { ...DEFAULTS, experiments: { ...DEFAULTS.experiments, youtubeBridge: true } };
      const bridgeOff = { ...DEFAULTS, experiments: { ...DEFAULTS.experiments, youtubeBridge: false } };
      expect(settingDescription("keepYouTubeAudio", bridgeOn)).not.toBe(
        settingDescription("keepYouTubeAudio", bridgeOff),
      );
    });
  });
});

describe("isSettingVisible", () => {
  it("is true for a setting with no visibility predicate", () => {
    expect(isSettingVisible("followPlayhead", DEFAULTS)).toBe(true);
  });

  describe("edge cases", () => {
    it("reads the predicate when the entry declares one", () => {
      expect(isSettingVisible("storageLimit", { ...DEFAULTS, smartCleanup: false })).toBe(false);
      expect(isSettingVisible("storageLimit", { ...DEFAULTS, smartCleanup: true })).toBe(true);
    });
  });
});

describe("visibleSettingIds", () => {
  it("keeps every id when none has a visibility predicate", () => {
    const ids = settingIdsInSection("confirmations");
    expect(visibleSettingIds(ids, DEFAULTS)).toEqual(ids);
  });

  it("drops a hidden id and keeps the rest in order", () => {
    const ids = settingIdsInSection("storage");
    const off = visibleSettingIds(ids, { ...DEFAULTS, smartCleanup: false });
    expect(off).not.toContain("storageLimit");
    expect(off).toEqual(ids.filter((id) => id !== "storageLimit"));
  });

  it("is the single owner SettingsSectionRows and search both read (positive control)", () => {
    const ids = settingIdsInSection("storage");
    const on = visibleSettingIds(ids, { ...DEFAULTS, smartCleanup: true });
    expect(on).toEqual(ids);
  });

  describe("edge cases", () => {
    it("returns an empty list for an empty input", () => {
      expect(visibleSettingIds([], DEFAULTS)).toEqual([]);
    });
  });
});
