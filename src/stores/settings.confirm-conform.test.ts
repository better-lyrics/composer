import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULTS, useSettingsStore } from "@/stores/settings";

describe("settings.confirmConformToGroup", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults to true", () => {
    expect(useSettingsStore.getState().confirmConformToGroup).toBe(true);
  });

  it("can be toggled via set()", () => {
    useSettingsStore.getState().set("confirmConformToGroup", false);
    expect(useSettingsStore.getState().confirmConformToGroup).toBe(false);
  });

  it("resetToDefaults preserves the user's choice", () => {
    useSettingsStore.getState().set("confirmConformToGroup", false);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().confirmConformToGroup).toBe(false);
  });

  it("is persisted to localStorage", () => {
    useSettingsStore.setState({ confirmConformToGroup: false });
    const raw = localStorage.getItem("composer-settings");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw ?? "{}");
    expect(persisted.state.confirmConformToGroup).toBe(false);
  });
});
