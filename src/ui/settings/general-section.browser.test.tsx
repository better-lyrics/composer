import { describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { GeneralSection } from "@/ui/settings/general-section";

describe("GeneralSection", () => {
  it("renders a switch for each toggle setting", async () => {
    const screen = await render(<GeneralSection onResetTour={() => {}} onClose={() => {}} />);
    expect(screen.container.querySelectorAll('[role="switch"]').length).toBe(2);
  });

  it("calls onResetTour and onClose when Reset tour is clicked", async () => {
    let resetTour = false;
    let closed = false;
    const screen = await render(
      <GeneralSection
        onResetTour={() => {
          resetTour = true;
        }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    await screen.getByRole("button", { name: /Reset tour/ }).click();
    await expect.poll(() => resetTour).toBe(true);
    await expect.poll(() => closed).toBe(true);
  });

  it("restores settings to defaults when Reset all is confirmed", async () => {
    useSettingsStore.setState({ defaultZoom: 999, confirmResetSettings: false });
    const screen = await render(<GeneralSection onResetTour={() => {}} onClose={() => {}} />);
    await screen.getByRole("button", { name: /Reset all/ }).click();
    await expect.poll(() => useSettingsStore.getState().defaultZoom).toBe(100);
  });
});
