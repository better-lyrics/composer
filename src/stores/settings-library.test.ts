import { DEFAULTS, useSettingsStore } from "@/stores/settings";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function rehydrateAt(version: number, state: Record<string, unknown>): Promise<void> {
  window.localStorage.setItem("composer-settings", JSON.stringify({ state, version }));
  await useSettingsStore.persist.rehydrate();
}

// -- Tests --------------------------------------------------------------------

describe("library settings", () => {
  it("defaults to the list view, last edited order and the Projects home", () => {
    const state = useSettingsStore.getState();
    expect(state.libraryView).toBe("list");
    expect(state.librarySort).toBe("edited");
    expect(state.launchScreen).toBe("projects");
  });

  describe("regressions", () => {
    it("regression: a settings blob saved before these keys existed still gets the defaults", async () => {
      const { libraryView: _libraryView, librarySort: _librarySort, launchScreen: _launchScreen, ...legacy } = DEFAULTS;
      await rehydrateAt(6, { ...legacy, defaultZoom: 240 });

      const state = useSettingsStore.getState();
      expect(state.libraryView).toBe("list");
      expect(state.librarySort).toBe("edited");
      expect(state.launchScreen).toBe("projects");
      expect(state.defaultZoom).toBe(240);
    });
  });
});
