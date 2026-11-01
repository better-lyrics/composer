import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { untilDialogFocused } from "@/test/dialog-focus";
import { render } from "@/test/render";
import { SettingsModal } from "@/ui/settings-modal";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

// The default test viewport is narrower than the loupe, which caps its width at the window.
const ROOMY_VIEWPORT = { width: 1280, height: 900 };
const DEFAULT_VIEWPORT = { width: 414, height: 896 };

describe("LoupeSizeLayer", () => {
  afterEach(async () => {
    await page.viewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
  });

  it("resizes the loupe from the keyboard and returns focus to Adjust on Escape", async () => {
    await page.viewport(ROOMY_VIEWPORT.width, ROOMY_VIEWPORT.height);
    useUIStore.getState().openSettings({ target: { setting: "loupeSize" } });
    const screen = await render(<SettingsModal isOpen onClose={() => {}} />);
    await untilDialogFocused();
    const adjust = screen.getByRole("button", { name: "Adjust" });
    await adjust.click();

    const card = screen.getByRole("group", { name: "Loupe preview" });
    await expect.poll(() => document.activeElement).toBe(card.element());
    await userEvent.keyboard("{ArrowRight}");
    expect(useSettingsStore.getState().loupeWidth).toBe(432);

    await userEvent.keyboard("{Escape}");
    await expect.element(card).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(adjust.element());
    await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});
