import { describe, expect, it } from "vitest";
import { SettingsModal } from "@/ui/settings-modal";
import { render } from "@/test/render";

describe("SettingsModal", () => {
  it("renders nothing when isOpen is false", async () => {
    await render(<SettingsModal isOpen={false} onClose={() => {}} onResetTour={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens with the Settings title and a sidebar of section buttons", async () => {
    const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const sectionButtons = document.querySelectorAll("dialog button");
    expect(sectionButtons.length).toBeGreaterThan(5);
  });

  it("switches the visible content when a different section is clicked", async () => {
    const screen = await render(<SettingsModal isOpen onClose={() => {}} onResetTour={() => {}} />);
    await screen.getByRole("button", { name: /Shortcuts/i }).click();
    expect(document.querySelector("dialog")?.textContent ?? "").toContain("Shortcut");
  });

  it("invokes onClose when Escape is pressed", async () => {
    let closes = 0;
    await render(<SettingsModal isOpen onClose={() => closes++} onResetTour={() => {}} />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closes).toBeGreaterThan(0);
  });
});
