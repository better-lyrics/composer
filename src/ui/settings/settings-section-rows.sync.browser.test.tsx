import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { describe, expect, it } from "vitest";

describe("SettingsSectionRows (sync)", () => {
  it("renders the split character control, sliders, and granularity select", async () => {
    const screen = await render(<SettingsSectionRows section="sync" />);
    await expect.element(screen.getByText("Split character")).toBeInTheDocument();
    await expect.element(screen.getByText("Re-record pre-roll")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Default granularity" })).toBeInTheDocument();
    expect(screen.container.querySelectorAll('input[type="range"]').length).toBe(5);
  });

  it("describes the count-in length and reads Off at 0", async () => {
    useSettingsStore.setState({ syncCountIn: 3 });
    const screen = await render(<SettingsSectionRows section="sync" />);
    await expect.element(screen.getByText("Count-in", { exact: true })).toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "Count down for 3 seconds before playback starts in Sync, so you are ready for the first word.",
        ),
      )
      .toBeInTheDocument();
    await expect.element(screen.getByText("3s", { exact: true })).toBeInTheDocument();
    useSettingsStore.setState({ syncCountIn: 0 });
    await expect.element(screen.getByText("Playback starts right away in Sync.")).toBeInTheDocument();
    await expect.element(screen.getByText("Off", { exact: true })).toBeInTheDocument();
  });

  it("uses the singular for a 1 second count-in", async () => {
    useSettingsStore.setState({ syncCountIn: 1 });
    const screen = await render(<SettingsSectionRows section="sync" />);
    await expect
      .element(
        screen.getByText(
          "Count down for 1 second before playback starts in Sync, so you are ready for the first word.",
        ),
      )
      .toBeInTheDocument();
  });

  it("updates the default granularity from the select", async () => {
    useSettingsStore.setState({ defaultGranularity: "word" });
    const screen = await render(<SettingsSectionRows section="sync" />);
    await screen.getByRole("button", { name: "Default granularity" }).click();
    await screen.getByRole("option", { name: "Line" }).click();
    await expect.poll(() => useSettingsStore.getState().defaultGranularity).toBe("line");
  });
});
