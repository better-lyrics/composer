import { DEFAULTS, migrateSettingsForTest, useSettingsStore } from "@/stores/settings";
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
    const migrated = migrateSettingsForTest(legacyBlob(), 5) as { preserveBracketsOnExtraction: boolean };
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
    const migrated = migrateSettingsForTest(blob, 5) as { preserveBracketsOnExtraction: boolean };
    expect(migrated.preserveBracketsOnExtraction).toBe(true);
  });

  it("edge case: tolerates a null persisted state", () => {
    expect(migrateSettingsForTest(null, 5)).toBeNull();
  });

  it("invariant: a fresh profile already gets the new default", () => {
    expect(DEFAULTS.preserveBracketsOnExtraction).toBe(true);
  });
});
