import { describe, expect, it } from "vitest";
import { DEFAULTS } from "@/stores/settings";
import { SETTING_IDS, settingEntry } from "@/stores/settings-catalog";
import { SETTING_CONTROLS } from "@/ui/settings/setting-controls-registry";

const EXPECTED_TYPE = { toggle: "boolean", slider: "number", select: "string" } as const;

describe("SETTING_CONTROLS", () => {
  it("backs every non-custom control with a store key of the matching type", () => {
    for (const id of SETTING_IDS) {
      const control = SETTING_CONTROLS[id];
      if (control.kind === "custom") continue;
      const key = settingEntry(id).settingKey;
      expect(key, id).toBeDefined();
      if (key === undefined) continue;
      expect(typeof DEFAULTS[key], id).toBe(EXPECTED_TYPE[control.kind]);
    }
  });

  it("offers the default value among every select's options", () => {
    for (const id of SETTING_IDS) {
      const control = SETTING_CONTROLS[id];
      const key = settingEntry(id).settingKey;
      if (control.kind !== "select" || key === undefined) continue;
      expect(
        control.options.map((option) => option.value),
        id,
      ).toContain(DEFAULTS[key]);
    }
  });

  it("keeps every slider default inside its range", () => {
    for (const id of SETTING_IDS) {
      const control = SETTING_CONTROLS[id];
      const key = settingEntry(id).settingKey;
      if (control.kind !== "slider" || key === undefined) continue;
      const value = DEFAULTS[key];
      expect(typeof value === "number" && value >= control.min && value <= control.max, id).toBe(true);
    }
  });
});
