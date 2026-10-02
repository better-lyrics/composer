import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { TOUR_RESUME_KEY, TOUR_SEEN_KEY } from "@/tour/use-tour";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

describe("SettingsSectionRows general", () => {
  it("renders a switch for each toggle setting", async () => {
    const screen = await render(<SettingsSectionRows section="general" />);
    expect(screen.container.querySelectorAll('[role="switch"]').length).toBe(5);
  });

  it("renders the background vocal toggles", async () => {
    const screen = await render(<SettingsSectionRows section="general" />);
    await expect.element(screen.getByRole("switch", { name: "Auto-extract background vocals" })).toBeInTheDocument();
    await expect.element(screen.getByRole("switch", { name: "Merge standalone background lines" })).toBeInTheDocument();
    await expect.element(screen.getByRole("switch", { name: "Preserve brackets when extracting" })).toBeInTheDocument();
  });

  it("flips preserveBracketsOnExtraction when its switch is clicked", async () => {
    useSettingsStore.setState({ preserveBracketsOnExtraction: false });
    const screen = await render(<SettingsSectionRows section="general" />);
    await screen.getByRole("switch", { name: "Preserve brackets when extracting" }).click();
    await expect.poll(() => useSettingsStore.getState().preserveBracketsOnExtraction).toBe(true);
  });

  it("flips autoExtractBackgroundVocals when its switch is clicked", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: true });
    const screen = await render(<SettingsSectionRows section="general" />);
    await screen.getByRole("switch", { name: "Auto-extract background vocals" }).click();
    await expect.poll(() => useSettingsStore.getState().autoExtractBackgroundVocals).toBe(false);
  });

  it("flips mergeStandaloneBackgroundLines when its switch is clicked", async () => {
    useSettingsStore.setState({ mergeStandaloneBackgroundLines: true });
    const screen = await render(<SettingsSectionRows section="general" />);
    await screen.getByRole("switch", { name: "Merge standalone background lines" }).click();
    await expect.poll(() => useSettingsStore.getState().mergeStandaloneBackgroundLines).toBe(false);
  });

  it("restarts the tour and closes Settings when Reset tour is clicked", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: 2, stepCount: 9 }));
    useUIStore.getState().openSettings();
    const screen = await render(<SettingsSectionRows section="general" />);
    await screen.getByRole("button", { name: /Reset tour/ }).click();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
    expect(localStorage.getItem(TOUR_RESUME_KEY)).toBeNull();
    expect(useUIStore.getState().settingsOpen).toBe(false);
  });

  it("resets the tour from the keyboard", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    const screen = await render(<SettingsSectionRows section="general" />);
    (screen.getByRole("button", { name: /Reset tour/ }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
  });

  it("labels the reset rows from the settings catalog", async () => {
    const screen = await render(<SettingsSectionRows section="general" />);
    await expect.element(screen.getByText("Reset product tour")).toBeInTheDocument();
    await expect.element(screen.getByText("Reset to defaults")).toBeInTheDocument();
  });

  it("restores settings to defaults when Reset all is confirmed", async () => {
    useSettingsStore.setState({ defaultZoom: 999, confirmResetSettings: false });
    const screen = await render(<SettingsSectionRows section="general" />);
    await screen.getByRole("button", { name: /Reset all/ }).click();
    await expect.poll(() => useSettingsStore.getState().defaultZoom).toBe(100);
  });

  describe("edge cases", () => {
    it("keeps the settings when Reset all is cancelled", async () => {
      useSettingsStore.setState({ defaultZoom: 999, confirmResetSettings: true });
      const screen = await render(
        <>
          <SettingsSectionRows section="general" />
          <ConfirmModalHost />
        </>,
      );
      await screen.getByRole("button", { name: /Reset all/ }).click();
      await screen.getByRole("button", { name: "Cancel" }).click();
      expect(useSettingsStore.getState().defaultZoom).toBe(999);
    });
  });
});
