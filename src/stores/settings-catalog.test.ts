import { describe, expect, it } from "vitest";
import { DEFAULTS } from "@/stores/settings";
import {
  SETTING_IDS,
  SETTINGS_SECTIONS,
  readSettingOn,
  sectionLabel,
  settingEntry,
  settingIdsInSection,
  settingKeyOf,
} from "@/stores/settings-catalog";

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
        const { label, description } = settingEntry(id);
        expect(label.length).toBeGreaterThan(0);
        expect(label).toBe(label.trim());
        expect(description).toBe(description.trim());
        expect(description.endsWith(".")).toBe(true);
      }
    });

    it("uses no em or en dashes", () => {
      for (const id of SETTING_IDS) {
        const { label, description, keywords = [] } = settingEntry(id);
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
