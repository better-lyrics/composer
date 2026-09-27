import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { BackToHelpChip } from "@/ui/settings/back-to-help-chip";

describe("BackToHelpChip", () => {
  it("renders nothing without a return point", async () => {
    useUIStore.getState().openSettings();
    const screen = await render(<BackToHelpChip />);
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("names the Help section it returns to", async () => {
    useUIStore.getState().openSettings({ returnTo: { section: "timeline", scrollTop: 0 } });
    const screen = await render(<BackToHelpChip />);
    await expect.element(screen.getByRole("button", { name: "Back to Help ・ Timeline" })).toBeInTheDocument();
  });

  it("closes Settings and reopens Help when activated from the keyboard", async () => {
    useUIStore.getState().openSettings({ returnTo: { section: "timeline", scrollTop: 90 } });
    const screen = await render(<BackToHelpChip />);
    (screen.getByRole("button").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(useUIStore.getState()).toMatchObject({
      settingsOpen: false,
      helpOpen: true,
      helpLocation: { section: "timeline", scrollTop: 90 },
    });
  });

  it("names the search it returns to", async () => {
    useUIStore.getState().openSettings({ returnTo: { section: "timeline", scrollTop: 0, query: "snap" } });
    const screen = await render(<BackToHelpChip />);
    await expect.element(screen.getByRole("button", { name: 'Back to Help ・ "snap"' })).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("falls back to plain Help for an unknown section", async () => {
      useUIStore.getState().openSettings({ returnTo: { section: "gone", scrollTop: 0 } });
      const screen = await render(<BackToHelpChip />);
      await expect.element(screen.getByRole("button", { name: "Back to Help" })).toBeInTheDocument();
    });
  });
});
