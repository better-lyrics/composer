import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { TimelineSection } from "@/ui/help-sections/timeline";

describe("TimelineSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<TimelineSection />);
    await expect.element(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<TimelineSection />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("documents the rolling edit tool", async () => {
    const screen = await render(<TimelineSection />);
    expect(screen.container.textContent).toContain("the rolling edit tool");
  });

  it("documents splitting a word into independent words", async () => {
    const screen = await render(<TimelineSection />);
    expect(screen.container.textContent).toContain("separate independent words");
  });

  it("documents the tiny-word minimum width", async () => {
    const screen = await render(<TimelineSection />);
    await expect.element(screen.getByText(/minimum on-screen width/i)).toBeInTheDocument();
  });

  it("documents explicit-word marking and detection", async () => {
    const screen = await render(<TimelineSection />);
    await expect.element(screen.getByRole("heading", { name: "Explicit words" })).toBeInTheDocument();
    await expect.element(screen.getByText(/composer:explicit/)).toBeInTheDocument();
  });

  it("does not list a stale Select toolbar entry", async () => {
    const screen = await render(<TimelineSection />);
    expect(screen.container.textContent).not.toContain("disables double-click word creation");
  });
});
