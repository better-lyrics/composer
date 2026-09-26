import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { GettingStartedSection } from "@/ui/help-sections/getting-started";

describe("GettingStartedSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<GettingStartedSection />);
    await expect.element(screen.getByRole("heading", { name: "1. Import your audio" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<GettingStartedSection />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("names every supported lyrics format in the drop-a-file step", async () => {
    const screen = await render(<GettingStartedSection />);
    expect(screen.container.textContent).toContain("lyrics file (.txt, .lrc, .srt, .ttml, .qrc)");
  });

  it("sandboxes the embedded tutorial iframe", async () => {
    const screen = await render(<GettingStartedSection />);
    const iframe = screen.container.querySelector('iframe[title="Composer tutorial"]');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-presentation allow-popups");
  });
});
