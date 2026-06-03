import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_COBALT_INSTANCE_ID,
  DEFAULTS,
  getActiveCobaltInstance,
  getRomanizationTurnstileSiteKey,
  isUsingDefaultCobaltInstance,
  useSettingsStore,
} from "@/stores/settings";

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

describe("romanization settings", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULTS });
  });

  it("starts with empty api base and site key", () => {
    expect(useSettingsStore.getState().romanizationApiBase).toBe("");
    expect(useSettingsStore.getState().romanizationTurnstileSiteKey).toBe("");
  });

  it("getRomanizationTurnstileSiteKey returns override when set", () => {
    useSettingsStore.setState({ romanizationTurnstileSiteKey: "self-key" });
    expect(getRomanizationTurnstileSiteKey()).toBe("self-key");
  });

  it("getRomanizationTurnstileSiteKey trims whitespace", () => {
    useSettingsStore.setState({ romanizationTurnstileSiteKey: "  k  " });
    expect(getRomanizationTurnstileSiteKey()).toBe("k");
  });

  it("getRomanizationTurnstileSiteKey falls back to VITE_TURNSTILE_SITEKEY when empty", () => {
    useSettingsStore.setState({ romanizationTurnstileSiteKey: "" });
    expect(getRomanizationTurnstileSiteKey()).toBe(import.meta.env.VITE_TURNSTILE_SITEKEY ?? "");
  });

  it("preserves romanization settings on resetToDefaults", () => {
    useSettingsStore.setState({
      romanizationApiBase: "https://x.test",
      romanizationTurnstileSiteKey: "k",
    });
    useSettingsStore.getState().resetToDefaults();
    expect(useSettingsStore.getState().romanizationApiBase).toBe("https://x.test");
    expect(useSettingsStore.getState().romanizationTurnstileSiteKey).toBe("k");
  });
});
