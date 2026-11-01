import { DEFAULTS, useSettingsStore } from "@/stores/settings";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function rehydrateAt(version: number, state: Record<string, unknown>): Promise<void> {
  window.localStorage.setItem("composer-settings", JSON.stringify({ state, version }));
  await useSettingsStore.persist.rehydrate();
}

function withoutStorageKeys(): Record<string, unknown> {
  const { keepYouTubeAudio: _keep, smartCleanup: _cleanup, storageLimit: _limit, ...legacy } = DEFAULTS;
  return legacy;
}

// -- Tests --------------------------------------------------------------------

describe("storage settings", () => {
  it("defaults to automatic YouTube audio, smart cleanup on and a 2 GB limit", () => {
    const state = useSettingsStore.getState();
    expect(state.keepYouTubeAudio).toBe("auto");
    expect(state.smartCleanup).toBe(true);
    expect(state.storageLimit).toBe("2gb");
  });

  it("keeps valid stored choices across the migration", async () => {
    await rehydrateAt(7, {
      ...withoutStorageKeys(),
      keepYouTubeAudio: "never",
      smartCleanup: false,
      storageLimit: "5gb",
    });
    const state = useSettingsStore.getState();
    expect(state.keepYouTubeAudio).toBe("never");
    expect(state.smartCleanup).toBe(false);
    expect(state.storageLimit).toBe("5gb");
  });

  describe("regressions", () => {
    it("regression: a settings blob saved before these keys existed still gets the defaults", async () => {
      await rehydrateAt(7, { ...withoutStorageKeys(), defaultZoom: 240 });
      const state = useSettingsStore.getState();
      expect(state.keepYouTubeAudio).toBe("auto");
      expect(state.smartCleanup).toBe(true);
      expect(state.storageLimit).toBe("2gb");
      expect(state.defaultZoom).toBe(240);
    });
  });

  describe("error paths", () => {
    it("drops values that are not one of the choices and falls back to the defaults", async () => {
      await rehydrateAt(7, {
        ...withoutStorageKeys(),
        keepYouTubeAudio: "sometimes",
        smartCleanup: "yes",
        storageLimit: "10gb",
      });
      const state = useSettingsStore.getState();
      expect(state.keepYouTubeAudio).toBe("auto");
      expect(state.smartCleanup).toBe(true);
      expect(state.storageLimit).toBe("2gb");
    });
  });
});
