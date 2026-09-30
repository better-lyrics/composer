import { useUIStore } from "@/stores/ui";
import { render } from "@/test/render";
import { SettingsModal } from "@/ui/settings-modal";
import { describe, expect, it } from "vitest";

describe("SettingsModal · Projects", () => {
  it("lists Projects right after General", async () => {
    await render(<SettingsModal isOpen onClose={() => {}} />);
    const labels = [...document.querySelectorAll("dialog button")].map((button) => button.textContent?.trim());
    const general = labels.indexOf("General");
    expect(general).toBeGreaterThanOrEqual(0);
    expect(labels[general + 1]).toBe("Projects");
  });

  it("shows the Projects settings when chosen", async () => {
    const screen = await render(<SettingsModal isOpen onClose={() => {}} />);
    await screen.getByRole("button", { name: "Projects" }).click();
    await expect.element(screen.getByText("Library view")).toBeInTheDocument();
  });

  it("opens on Save & Storage when asked for the storage section", async () => {
    useUIStore.getState().openSettings({ target: { section: "storage" } });
    const screen = await render(<SettingsModal isOpen onClose={() => {}} />);
    await expect.element(screen.getByText("Auto-save delay")).toBeInTheDocument();
  });
});
