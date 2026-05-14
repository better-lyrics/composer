import { describe, expect, it } from "vitest";
import { HelpModal } from "@/ui/help-modal";
import { render } from "@/test/render";

describe("HelpModal", () => {
  it("renders nothing when isOpen is false", async () => {
    await render(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens with the Help title and a sidebar of section buttons", async () => {
    const screen = await render(<HelpModal isOpen onClose={() => {}} />);
    await expect.element(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
    const sectionButtons = document.querySelectorAll("dialog button");
    expect(sectionButtons.length).toBeGreaterThan(2);
  });

  it("switches the visible section content when a sidebar button is clicked", async () => {
    await render(<HelpModal isOpen onClose={() => {}} />);
    const firstContent = document.querySelector("dialog")?.textContent ?? "";
    const sectionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("dialog button"));
    const secondaryButton = sectionButtons.find((b) => b.textContent && b.textContent !== "");
    if (!secondaryButton) throw new Error("No section button");
    secondaryButton.click();
    expect(document.querySelector("dialog")?.textContent ?? "").toBe(firstContent);
  });

  it("invokes onClose when Escape is pressed", async () => {
    let closeCalls = 0;
    await render(<HelpModal isOpen onClose={() => closeCalls++} />);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closeCalls).toBeGreaterThan(0);
  });
});
