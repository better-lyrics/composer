import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { SettingRow } from "@/ui/settings/setting-row";

const rowOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-setting-id]");

describe("SettingRow", () => {
  it("wraps the control in a row tagged with the setting id", async () => {
    const screen = await render(<SettingRow id="followPlayhead" />);
    expect(rowOf(screen.container)?.dataset.settingId).toBe("followPlayhead");
  });

  it("renders a switch for a toggle setting and flips it from the keyboard", async () => {
    useSettingsStore.setState({ followPlayhead: false });
    const screen = await render(<SettingRow id="followPlayhead" />);
    (screen.getByRole("switch", { name: "Follow playhead" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useSettingsStore.getState().followPlayhead).toBe(true);
  });

  it("renders a slider with the registry format", async () => {
    useSettingsStore.setState({ timelineSnapThreshold: 12 });
    const screen = await render(<SettingRow id="timelineSnapThreshold" />);
    await expect.element(screen.getByRole("slider", { name: "Snap threshold" })).toBeInTheDocument();
    await expect.element(screen.getByText("12px")).toBeInTheDocument();
  });

  it("renders a select with the registry options", async () => {
    const screen = await render(<SettingRow id="defaultGranularity" />);
    await screen.getByRole("button", { name: "Default granularity" }).click();
    await expect.element(screen.getByRole("option", { name: "Line" })).toBeInTheDocument();
  });

  it("renders a custom block inside the row", async () => {
    const screen = await render(<SettingRow id="cobaltInstances" />);
    await expect.element(screen.getByText("Cobalt instances")).toBeInTheDocument();
    expect(rowOf(screen.container)?.dataset.settingId).toBe("cobaltInstances");
  });

  describe("invariants", () => {
    it("positions the row so the nudge overlay anchors to it", async () => {
      const screen = await render(<SettingRow id="followPlayhead" />);
      expect(rowOf(screen.container)?.className).toContain("relative");
    });
  });
});
