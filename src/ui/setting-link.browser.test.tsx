import { describe, expect, it } from "vitest";
import { Toaster, toast } from "sonner";
import { userEvent } from "vitest/browser";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { SettingHint } from "@/ui/setting-hint";
import { SettingLink } from "@/ui/setting-link";
import { APP_SETTING_LINK_HOST, SettingLinkContext, type SettingLinkHost } from "@/ui/setting-link-context";

const inApp = (node: React.ReactNode, host: SettingLinkHost = APP_SETTING_LINK_HOST) => (
  <SettingLinkContext value={host}>{node}</SettingLinkContext>
);

describe("SettingLink", () => {
  it("shows the section crumb and the catalog label", async () => {
    const screen = await render(inApp(<SettingLink setting="timelineHorizontalScroll" />));
    await expect.element(screen.getByRole("button")).toHaveTextContent("Timeline");
    await expect.element(screen.getByRole("button")).toHaveTextContent("Scroll wheel scrolls timeline");
  });

  it("opens Settings at the setting on click", async () => {
    const screen = await render(inApp(<SettingLink setting="timelineHorizontalScroll" />));
    await screen.getByRole("button").click();
    expect(useUIStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: "timeline",
      settingsTarget: { setting: "timelineHorizontalScroll" },
      settingsReturnTo: null,
    });
  });

  it("records the host's return point", async () => {
    useUIStore.getState().openHelp("timeline");
    const host: SettingLinkHost = { returnPoint: () => ({ section: "timeline", scrollTop: 320 }) };
    const screen = await render(inApp(<SettingLink setting="followPlayhead" />, host));
    await screen.getByRole("button").click();
    expect(useUIStore.getState().settingsReturnTo).toEqual({ section: "timeline", scrollTop: 320 });
    expect(useUIStore.getState().helpOpen).toBe(false);
  });

  it("opens from the keyboard", async () => {
    const screen = await render(inApp(<SettingLink setting="followPlayhead" />));
    (screen.getByRole("button").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(useUIStore.getState().settingsOpen).toBe(true);
  });

  it("links to a whole section", async () => {
    const screen = await render(inApp(<SettingLink section="shortcuts" />));
    await expect.element(screen.getByRole("button", { name: "Open Shortcuts settings" })).toBeInTheDocument();
    await screen.getByRole("button").click();
    expect(useUIStore.getState().settingsSection).toBe("shortcuts");
  });

  describe("state mark", () => {
    it("names the current value and follows the store live", async () => {
      useSettingsStore.setState({ followPlayhead: true });
      const screen = await render(inApp(<SettingLink setting="followPlayhead" />));
      await expect
        .element(screen.getByRole("button", { name: "Open setting Follow playhead, on" }))
        .toBeInTheDocument();
      useSettingsStore.setState({ followPlayhead: false });
      await expect
        .element(screen.getByRole("button", { name: "Open setting Follow playhead, off" }))
        .toBeInTheDocument();
    });

    it("reads custom on/off settings", async () => {
      useSettingsStore.setState({ experiments: { ...useSettingsStore.getState().experiments, youtubeBridge: true } });
      const screen = await render(inApp(<SettingLink setting="youtubeBridge" />));
      await expect
        .element(screen.getByRole("button", { name: "Open setting Composer Bridge for YouTube, on" }))
        .toBeInTheDocument();
    });

    it("has no mark for a setting that is not on or off", async () => {
      const screen = await render(inApp(<SettingLink setting="nudgeAmount" />));
      await expect.element(screen.getByRole("button", { name: "Open setting Nudge amount" })).toBeInTheDocument();
      expect(screen.container.querySelector("[data-setting-state]")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("renders plain text outside the app, where Settings does not exist", async () => {
      const screen = await render(<SettingLink setting="preserveBracketsOnExtraction" />);
      expect(screen.container.querySelector("button")).toBeNull();
      expect(screen.container.textContent).toContain("Preserve brackets when extracting");
    });
  });

  describe("regressions", () => {
    it("regression: the plain-text fallback shows only the label, never the section crumb", async () => {
      const screen = await render(<SettingLink setting="preserveBracketsOnExtraction" />);
      expect(screen.container.textContent).toBe("Preserve brackets when extracting");
    });

    it("regression: stays a working link inside a sonner toast", async () => {
      const screen = await render(inApp(<Toaster />));
      toast.error("Blocked", {
        description: <SettingHint hint={{ text: "Try a different cobalt instance in", setting: "cobaltInstances" }} />,
      });
      await screen.getByRole("button", { name: "Open setting Cobalt instances" }).click();
      expect(useUIStore.getState().settingsTarget).toEqual({ setting: "cobaltInstances" });
    });
  });
});
