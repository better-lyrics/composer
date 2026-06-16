import {
  DEFAULTS,
  DEFAULT_COBALT_INSTANCE_ID,
  getActiveCobaltInstance,
  isUsingDefaultCobaltInstance,
  useSettingsStore,
} from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("preview renderer settings", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults to braccato as the preview renderer", () => {
    expect(useSettingsStore.getState().previewRenderer).toBe("braccato");
  });

  it("defaults audioScrubPreview to true", () => {
    expect(useSettingsStore.getState().audioScrubPreview).toBe(true);
  });

  it("allows switching renderer via set()", () => {
    useSettingsStore.getState().set("previewRenderer", "am-lyrics");
    expect(useSettingsStore.getState().previewRenderer).toBe("am-lyrics");
  });

  it("resetToDefaults restores the renderer to braccato", () => {
    useSettingsStore.getState().set("previewRenderer", "am-lyrics");
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().previewRenderer).toBe("braccato");
  });
});

describe("vocal model settings", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults to fp32 for stable browser inference", () => {
    expect(useSettingsStore.getState().vocalModelVariant).toBe("fp32");
  });
});

describe("background vocal extraction settings", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults autoExtractBackgroundVocals to true", () => {
    expect(DEFAULTS.autoExtractBackgroundVocals).toBe(true);
    expect(useSettingsStore.getState().autoExtractBackgroundVocals).toBe(true);
  });

  it("defaults mergeStandaloneBackgroundLines to true", () => {
    expect(DEFAULTS.mergeStandaloneBackgroundLines).toBe(true);
    expect(useSettingsStore.getState().mergeStandaloneBackgroundLines).toBe(true);
  });

  it("defaults preserveBracketsOnExtraction to false", () => {
    expect(DEFAULTS.preserveBracketsOnExtraction).toBe(false);
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(false);
  });

  it("allows toggling preserveBracketsOnExtraction via set()", () => {
    useSettingsStore.getState().set("preserveBracketsOnExtraction", true);
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(true);
    useSettingsStore.getState().set("preserveBracketsOnExtraction", false);
    expect(useSettingsStore.getState().preserveBracketsOnExtraction).toBe(false);
  });

  it("allows toggling autoExtractBackgroundVocals via set()", () => {
    useSettingsStore.getState().set("autoExtractBackgroundVocals", false);
    expect(useSettingsStore.getState().autoExtractBackgroundVocals).toBe(false);
    useSettingsStore.getState().set("autoExtractBackgroundVocals", true);
    expect(useSettingsStore.getState().autoExtractBackgroundVocals).toBe(true);
  });

  it("allows disabling mergeStandaloneBackgroundLines via set()", () => {
    useSettingsStore.getState().set("mergeStandaloneBackgroundLines", false);
    expect(useSettingsStore.getState().mergeStandaloneBackgroundLines).toBe(false);
  });

  it("resetToDefaults restores the background vocal toggles", () => {
    useSettingsStore.getState().set("autoExtractBackgroundVocals", false);
    useSettingsStore.getState().set("mergeStandaloneBackgroundLines", false);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().autoExtractBackgroundVocals).toBe(true);
    expect(useSettingsStore.getState().mergeStandaloneBackgroundLines).toBe(true);
  });
});

describe("vocal onset snap settings", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults vocalOnsetSnap to true", () => {
    expect(DEFAULTS.vocalOnsetSnap).toBe(true);
    expect(useSettingsStore.getState().vocalOnsetSnap).toBe(true);
  });

  it("allows toggling vocalOnsetSnap via set()", () => {
    useSettingsStore.getState().set("vocalOnsetSnap", false);
    expect(useSettingsStore.getState().vocalOnsetSnap).toBe(false);
    useSettingsStore.getState().set("vocalOnsetSnap", true);
    expect(useSettingsStore.getState().vocalOnsetSnap).toBe(true);
  });

  it("resetToDefaults restores vocalOnsetSnap to true", () => {
    useSettingsStore.getState().set("vocalOnsetSnap", false);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().vocalOnsetSnap).toBe(true);
  });
});

describe("cobalt instance helpers", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...DEFAULTS,
      cobaltInstances: [],
      selectedCobaltInstanceId: DEFAULT_COBALT_INSTANCE_ID,
    });
  });

  it("isUsingDefaultCobaltInstance returns true when default is selected", () => {
    expect(isUsingDefaultCobaltInstance()).toBe(true);
  });

  it("isUsingDefaultCobaltInstance returns false when a custom instance is active", () => {
    useSettingsStore.getState().addCobaltInstance({ label: "Custom", url: "https://example.test" });
    const custom = useSettingsStore.getState().cobaltInstances[0];
    useSettingsStore.getState().selectCobaltInstance(custom.id);
    expect(isUsingDefaultCobaltInstance()).toBe(false);
  });

  it("isUsingDefaultCobaltInstance falls back to default when selected id is missing", () => {
    useSettingsStore.setState({ selectedCobaltInstanceId: "ghost-id" });
    expect(isUsingDefaultCobaltInstance()).toBe(true);
  });

  it("getActiveCobaltInstance returns the built-in for the default id", () => {
    expect(getActiveCobaltInstance().id).toBe(DEFAULT_COBALT_INSTANCE_ID);
  });

  it("getActiveCobaltInstance returns the matching custom instance", () => {
    useSettingsStore.getState().addCobaltInstance({ label: "Custom", url: "https://example.test" });
    const custom = useSettingsStore.getState().cobaltInstances[0];
    useSettingsStore.getState().selectCobaltInstance(custom.id);
    expect(getActiveCobaltInstance().url).toBe("https://example.test");
  });
});

describe("timeline header toggle defaults", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("defaults defaultRollingEdit to false", () => {
    expect(DEFAULTS.defaultRollingEdit).toBe(false);
    expect(useSettingsStore.getState().defaultRollingEdit).toBe(false);
  });

  it("defaults defaultPreviewSidebar to false", () => {
    expect(DEFAULTS.defaultPreviewSidebar).toBe(false);
    expect(useSettingsStore.getState().defaultPreviewSidebar).toBe(false);
  });

  it("set() persists defaultRollingEdit", () => {
    useSettingsStore.getState().set("defaultRollingEdit", true);
    expect(useSettingsStore.getState().defaultRollingEdit).toBe(true);
  });

  it("set() persists defaultPreviewSidebar", () => {
    useSettingsStore.getState().set("defaultPreviewSidebar", true);
    expect(useSettingsStore.getState().defaultPreviewSidebar).toBe(true);
  });

  it("resetToDefaults restores both to false", () => {
    useSettingsStore.getState().set("defaultRollingEdit", true);
    useSettingsStore.getState().set("defaultPreviewSidebar", true);
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().defaultRollingEdit).toBe(false);
    expect(useSettingsStore.getState().defaultPreviewSidebar).toBe(false);
  });
});

describe("settings v2 -> v3 migration", () => {
  it("fills missing defaultRollingEdit with false", async () => {
    const { migrateSettingsForTest } = await import("@/stores/settings");
    const migrated = migrateSettingsForTest({ defaultZoom: 200 }, 2) as { defaultRollingEdit: boolean };
    expect(migrated.defaultRollingEdit).toBe(false);
  });

  it("fills missing defaultPreviewSidebar with false", async () => {
    const { migrateSettingsForTest } = await import("@/stores/settings");
    const migrated = migrateSettingsForTest({ defaultZoom: 200 }, 2) as { defaultPreviewSidebar: boolean };
    expect(migrated.defaultPreviewSidebar).toBe(false);
  });

  it("preserves user-set values when migrating from v3", async () => {
    const { migrateSettingsForTest } = await import("@/stores/settings");
    const migrated = migrateSettingsForTest({ defaultRollingEdit: true, defaultPreviewSidebar: true }, 3) as {
      defaultRollingEdit: boolean;
      defaultPreviewSidebar: boolean;
    };
    expect(migrated.defaultRollingEdit).toBe(true);
    expect(migrated.defaultPreviewSidebar).toBe(true);
  });

  it("still applies the vocalModelVariant fp16 -> fp32 rule", async () => {
    const { migrateSettingsForTest } = await import("@/stores/settings");
    const migrated = migrateSettingsForTest({ vocalModelVariant: "fp16" }, 2) as { vocalModelVariant: string };
    expect(migrated.vocalModelVariant).toBe("fp32");
  });
});

describe("settings v3 -> v4 migration (vocalOnsetSnap)", () => {
  it("fills missing vocalOnsetSnap with true", async () => {
    const { migrateSettingsForTest } = await import("@/stores/settings");
    const migrated = migrateSettingsForTest({ defaultZoom: 200 }, 3) as { vocalOnsetSnap: boolean };
    expect(migrated.vocalOnsetSnap).toBe(true);
  });

  it("preserves an explicitly disabled vocalOnsetSnap", async () => {
    const { migrateSettingsForTest } = await import("@/stores/settings");
    const migrated = migrateSettingsForTest({ vocalOnsetSnap: false }, 3) as { vocalOnsetSnap: boolean };
    expect(migrated.vocalOnsetSnap).toBe(false);
  });
});

describe("timeline store reads header-toggle defaults at init", () => {
  it("initial previewSidebarOpen matches settings.defaultPreviewSidebar at the moment the store was created", () => {
    expect(useTimelineStore.getState().previewSidebarOpen).toBe(useSettingsStore.getState().defaultPreviewSidebar);
  });

  it("initial rollingEditMode matches settings.defaultRollingEdit at the moment the store was created", () => {
    expect(useTimelineStore.getState().rollingEditMode).toBe(useSettingsStore.getState().defaultRollingEdit);
  });
});
