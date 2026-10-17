import { DEFAULTS, useSettingsStore } from "@/stores/settings";
import { migrateSettings } from "@/stores/settings-migration";
import { beforeEach, describe, expect, it } from "vitest";

// A settings blob as written by 1.37.x: every key is present, so an
// `=== undefined` migration guard never fires for any of them.
function legacyBlob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...DEFAULTS, preserveBracketsOnExtraction: false, defaultZoom: 140, ...overrides };
}

async function rehydrateAt(version: number, state: Record<string, unknown>): Promise<void> {
  window.localStorage.setItem("composer-settings", JSON.stringify({ state, version }));
  await useSettingsStore.persist.rehydrate();
}

beforeEach(() => {
  window.localStorage.removeItem("composer-settings");
  useSettingsStore.setState({ ...DEFAULTS });
});

describe("preserveBracketsOnExtraction migration", () => {
  it("regression: an inherited false from a pre-1.38 blob is lifted to the new default", async () => {
    await rehydrateAt(5, legacyBlob());
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(true);
  });

  it("regression: the fix reaches an existing user, not just a fresh profile", async () => {
    const migrated = migrateSettings(legacyBlob(), 5) as { preserveBracketsOnExtraction: boolean };
    expect(migrated.preserveBracketsOnExtraction).toBe(true);
  });

  it("leaves a choice made after the flip alone", async () => {
    await rehydrateAt(6, legacyBlob({ preserveBracketsOnExtraction: false }));
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(false);
  });

  it("is idempotent across a second rehydrate at the current version", async () => {
    await rehydrateAt(5, legacyBlob());
    const first = useSettingsStore.getState().preserveBracketsOnExtraction;
    await rehydrateAt(6, { ...legacyBlob(), preserveBracketsOnExtraction: first });
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(true);
  });

  it("preserves unrelated persisted settings while migrating", async () => {
    await rehydrateAt(5, legacyBlob({ defaultZoom: 200 }));
    expect(useSettingsStore.getState().defaultZoom).toBe(200);
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(true);
  });

  it("edge case: tolerates a blob missing the key entirely", () => {
    const { preserveBracketsOnExtraction: _omitted, ...blob } = legacyBlob();
    const migrated = migrateSettings(blob, 5) as { preserveBracketsOnExtraction: boolean };
    expect(migrated.preserveBracketsOnExtraction).toBe(true);
  });

  it("edge case: tolerates a null persisted state", () => {
    expect(migrateSettings(null, 5)).toBeNull();
  });

  it("invariant: a fresh profile already gets the new default", () => {
    expect(DEFAULTS.preserveBracketsOnExtraction).toBe(true);
  });
});

describe("syllablesFollowRolling", () => {
  it("stays off for an existing profile saved before the setting existed", async () => {
    const { syllablesFollowRolling: _omitted, ...blobWithoutKey } = legacyBlob();
    await rehydrateAt(6, blobWithoutKey);
    expect(useSettingsStore.getState().syllablesFollowRolling).toBe(false);
  });

  it("keeps an opt-in across a rehydrate", async () => {
    await rehydrateAt(6, legacyBlob({ syllablesFollowRolling: true }));
    expect(useSettingsStore.getState().syllablesFollowRolling).toBe(true);
  });
});

describe("retired confirmReplaceProjectFromHash", () => {
  it("drops the retired key from a persisted blob", async () => {
    await rehydrateAt(6, legacyBlob({ confirmReplaceProjectFromHash: false }));
    expect("confirmReplaceProjectFromHash" in useSettingsStore.getState()).toBe(false);
  });

  it("keeps the other confirmations while dropping it", () => {
    const migrated = migrateSettings(
      legacyBlob({ confirmReplaceProjectFromHash: false, confirmReplaceLyrics: false }),
      6,
    ) as Record<string, unknown>;
    expect(migrated).not.toHaveProperty("confirmReplaceProjectFromHash");
    expect(migrated.confirmReplaceLyrics).toBe(false);
  });
});

describe("library preference validation", () => {
  it("drops an unknown sort, view or launch screen so the defaults apply", async () => {
    await rehydrateAt(6, legacyBlob({ librarySort: "size", libraryView: "table", launchScreen: "editor" }));
    const state = useSettingsStore.getState();
    expect(state.librarySort).toBe(DEFAULTS.librarySort);
    expect(state.libraryView).toBe(DEFAULTS.libraryView);
    expect(state.launchScreen).toBe(DEFAULTS.launchScreen);
  });

  it("keeps valid choices", async () => {
    await rehydrateAt(6, legacyBlob({ librarySort: "title", libraryView: "grid", launchScreen: "last-project" }));
    const state = useSettingsStore.getState();
    expect(state.librarySort).toBe("title");
    expect(state.libraryView).toBe("grid");
    expect(state.launchScreen).toBe("last-project");
  });
});

describe("previewSidebarWidth", () => {
  it("gives a saved blob from before the setting existed the default width", async () => {
    const { previewSidebarWidth: _omitted, ...withoutWidth } = legacyBlob();
    await rehydrateAt(6, withoutWidth);
    expect(useSettingsStore.getState().previewSidebarWidth).toBe(320);
  });

  it("keeps a remembered width across a rehydrate", async () => {
    await rehydrateAt(6, legacyBlob({ previewSidebarWidth: 480 }));
    expect(useSettingsStore.getState().previewSidebarWidth).toBe(480);
  });
});
