import type { Theme } from "@/domain/theme/model";
import { useThemeStore } from "@/stores/theme";
import { beforeEach, describe, expect, it } from "vitest";

function makeCustom(id: string): Theme {
  return { id, name: "My Theme", kind: "custom", scheme: "dark", tokens: { accent: "#123456" } };
}

async function rehydrate(state: Record<string, unknown>, version: number): Promise<string[]> {
  window.localStorage.setItem("composer-theme", JSON.stringify({ state, version }));
  await useThemeStore.persist.rehydrate();
  return useThemeStore.getState().favoriteThemeIds;
}

beforeEach(() => {
  window.localStorage.removeItem("composer-theme");
  useThemeStore.setState({ activeThemeId: "default", customThemes: [], favoriteThemeIds: [] });
});

describe("theme store · favorites", () => {
  it("starts new users with no favorites", () => {
    expect(useThemeStore.getState().favoriteThemeIds).toEqual([]);
  });

  it("toggles a favorite on and off", () => {
    useThemeStore.getState().toggleFavoriteTheme("moss");
    expect(useThemeStore.getState().favoriteThemeIds).toEqual(["moss"]);
    useThemeStore.getState().toggleFavoriteTheme("moss");
    expect(useThemeStore.getState().favoriteThemeIds).toEqual([]);
  });

  it("keeps favorites in the order they were starred", () => {
    useThemeStore.getState().toggleFavoriteTheme("moss");
    useThemeStore.getState().toggleFavoriteTheme("dracula");
    expect(useThemeStore.getState().favoriteThemeIds).toEqual(["moss", "dracula"]);
  });

  it("drops a deleted custom theme from favorites", () => {
    useThemeStore.setState({ customThemes: [makeCustom("custom-1")], favoriteThemeIds: ["custom-1", "default"] });
    useThemeStore.getState().deleteCustomTheme("custom-1");
    expect(useThemeStore.getState().favoriteThemeIds).toEqual(["default"]);
  });
});

describe("theme store · favorites migration", () => {
  it("stars the current theme and Default for an existing user", async () => {
    expect(await rehydrate({ activeThemeId: "dracula", customThemes: [] }, 2)).toEqual(["dracula", "default"]);
  });

  it("stars only Default for an existing user on Default", async () => {
    expect(await rehydrate({ activeThemeId: "default", customThemes: [] }, 2)).toEqual(["default"]);
  });

  it("migrates a v1 user through every step", async () => {
    expect(await rehydrate({ activeThemeId: "moss", customThemes: [] }, 1)).toEqual(["moss", "default"]);
  });

  it("edge case: stars Default when the saved state has no active theme", async () => {
    expect(await rehydrate({ customThemes: [] }, 2)).toEqual(["default"]);
  });

  it("keeps saved favorites once migrated", async () => {
    expect(await rehydrate({ activeThemeId: "dracula", customThemes: [], favoriteThemeIds: [] }, 3)).toEqual([]);
  });
});
