import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULTS, useSettingsStore } from "@/stores/settings";

describe("settings.confirmClearImportedSongDetails", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults to true", () => {
    expect(useSettingsStore.getState().confirmClearImportedSongDetails).toBe(true);
  });

  it("can be toggled via set()", () => {
    useSettingsStore.getState().set("confirmClearImportedSongDetails", false);
    expect(useSettingsStore.getState().confirmClearImportedSongDetails).toBe(false);
  });

  it("resetToDefaults preserves the user's choice", () => {
    useSettingsStore.getState().set("confirmClearImportedSongDetails", false);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().confirmClearImportedSongDetails).toBe(false);
  });

  it("is persisted to localStorage", () => {
    useSettingsStore.setState({ confirmClearImportedSongDetails: false });
    const raw = localStorage.getItem("composer-settings");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw ?? "{}");
    expect(persisted.state.confirmClearImportedSongDetails).toBe(false);
  });
});
