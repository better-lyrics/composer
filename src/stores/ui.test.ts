import { UI_INITIAL_STATE, useUIStore } from "@/stores/ui";
import { beforeEach, describe, expect, it } from "vitest";

// -- Setup ---------------------------------------------------------------------

beforeEach(() => {
  useUIStore.setState({ ...UI_INITIAL_STATE });
});

const state = () => useUIStore.getState();

// -- Tests ---------------------------------------------------------------------

describe("useUIStore", () => {
  describe("openSettings", () => {
    it("opens on General with no target, query, or return point", () => {
      state().openSettings();
      expect(state()).toMatchObject({
        settingsOpen: true,
        settingsSection: "general",
        settingsQuery: "",
        settingsTarget: null,
        settingsReturnTo: null,
      });
    });

    it("opens on the target setting's section and keeps the target", () => {
      state().openSettings({ target: { setting: "timelineHorizontalScroll" } });
      expect(state().settingsSection).toBe("timeline");
      expect(state().settingsTarget).toEqual({ setting: "timelineHorizontalScroll" });
    });

    it("opens on a section target", () => {
      state().openSettings({ target: { section: "shortcuts" } });
      expect(state().settingsSection).toBe("shortcuts");
    });

    it("closes Help and records the return point when given one", () => {
      state().openHelp("timeline");
      state().openSettings({
        target: { setting: "followPlayhead" },
        returnTo: { section: "timeline", scrollTop: 240 },
      });
      expect(state().helpOpen).toBe(false);
      expect(state().settingsReturnTo).toEqual({ section: "timeline", scrollTop: 240 });
    });

    it("clears a search query left from before", () => {
      state().openSettings();
      state().setSettingsQuery("snap");
      state().openSettings({ target: { setting: "youtubeBridge" } });
      expect(state().settingsQuery).toBe("");
    });

    it("keeps the existing return point when retargeted while open", () => {
      state().openSettings({ target: { setting: "followPlayhead" }, returnTo: { section: "timeline", scrollTop: 10 } });
      state().openSettings({ target: { setting: "youtubeBridge" } });
      expect(state().settingsReturnTo).toEqual({ section: "timeline", scrollTop: 10 });
    });
  });

  describe("closeSettings", () => {
    it("closes without reopening Help when there is no return point", () => {
      state().openSettings();
      state().closeSettings();
      expect(state().settingsOpen).toBe(false);
      expect(state().helpOpen).toBe(false);
    });

    it("reopens Help at the recorded location and clears the return point", () => {
      state().openSettings({
        target: { setting: "followPlayhead" },
        returnTo: { section: "timeline", scrollTop: 240 },
      });
      state().closeSettings();
      expect(state()).toMatchObject({
        settingsOpen: false,
        settingsTarget: null,
        settingsReturnTo: null,
        helpOpen: true,
        helpLocation: { section: "timeline", scrollTop: 240 },
      });
    });
  });

  describe("returning to a Help search", () => {
    it("reopens Help with the search it came from", () => {
      state().openSettings({
        target: { setting: "timelineSnapThreshold" },
        returnTo: { section: "timeline", scrollTop: 40, query: "snap threshold" },
      });
      state().closeSettings();
      expect(state().helpLocation).toEqual({ section: "timeline", scrollTop: 40, query: "snap threshold" });
    });

    it("opens Help fresh without a query", () => {
      state().openHelp("timeline");
      expect(state().helpLocation.query).toBeUndefined();
    });
  });

  describe("section and query", () => {
    it("changing section clears the query", () => {
      state().openSettings();
      state().setSettingsQuery("snap");
      state().setSettingsSection("sync");
      expect(state().settingsSection).toBe("sync");
      expect(state().settingsQuery).toBe("");
    });

    it("consumeSettingsTarget clears only the target", () => {
      state().openSettings({ target: { setting: "followPlayhead" } });
      state().consumeSettingsTarget();
      expect(state().settingsTarget).toBeNull();
      expect(state().settingsOpen).toBe(true);
    });
  });

  describe("help", () => {
    it("opens Help at the top of the requested section", () => {
      state().openHelp("best-practices");
      expect(state().helpLocation).toEqual({ section: "best-practices", scrollTop: 0 });
    });

    it("opens Help at Getting Started by default", () => {
      state().openHelp();
      expect(state().helpLocation.section).toBe("getting-started");
    });

    it("closeHelp closes it", () => {
      state().openHelp();
      state().closeHelp();
      expect(state().helpOpen).toBe(false);
    });
  });

  describe("invariants", () => {
    it("does not persist across reloads", () => {
      state().openSettings({ target: { setting: "youtubeBridge" } });
      expect(localStorage.getItem("composer-ui")).toBeNull();
    });
  });
});
