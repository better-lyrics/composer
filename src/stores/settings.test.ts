import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_COBALT_INSTANCE_ID,
  DEFAULTS,
  getActiveCobaltInstance,
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
