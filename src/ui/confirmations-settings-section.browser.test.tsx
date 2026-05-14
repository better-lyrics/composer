import { describe, expect, it } from "vitest";
import { ConfirmationsSettingsSection } from "@/ui/confirmations-settings-section";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";

describe("ConfirmationsSettingsSection", () => {
  it("renders one switch per confirmation prompt", async () => {
    const screen = await render(<ConfirmationsSettingsSection />);
    const switches = screen.container.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThanOrEqual(6);
  });

  function toggleForLabel(text: string): HTMLElement {
    const label = Array.from(document.querySelectorAll("span")).find((el) => el.textContent === text);
    if (!label) throw new Error(`label not found: ${text}`);
    const row = label.closest('[class*="justify-between"]') as HTMLElement;
    const toggle = row.querySelector('[role="switch"]') as HTMLElement;
    if (!toggle) throw new Error(`switch not found in row for: ${text}`);
    return toggle;
  }

  it("reflects the current settings state via aria-checked", async () => {
    useSettingsStore.setState({ confirmReplaceLyrics: false });
    await render(<ConfirmationsSettingsSection />);
    const toggle = toggleForLabel("Confirm replacing lyrics on import");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("flips the settings value when a toggle is clicked", async () => {
    await render(<ConfirmationsSettingsSection />);
    expect(useSettingsStore.getState().confirmClearProject).toBe(true);
    const toggle = toggleForLabel("Confirm clearing project");
    toggle.click();
    expect(useSettingsStore.getState().confirmClearProject).toBe(false);
  });
});
