import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { TimelineExtras } from "@/ui/help-sections/timeline-extras";

describe("TimelineExtras", () => {
  it("renders the section content", async () => {
    const screen = await render(<TimelineExtras />);
    await expect.element(screen.getByRole("heading", { name: "Header toolbar" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<TimelineExtras />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("documents explicit-word marking and the TTML attribute", async () => {
    const screen = await render(<TimelineExtras />);
    await expect.element(screen.getByRole("heading", { name: "Explicit words" })).toBeInTheDocument();
    await expect.element(screen.getByText(/composer:explicit/)).toBeInTheDocument();
  });

  it("documents playhead-anchored zoom on the header buttons", async () => {
    const screen = await render(<TimelineExtras />);
    expect(screen.container.textContent).toContain("playhead pinned in place");
  });

  it("documents header-toggle persistence", async () => {
    const screen = await render(<TimelineExtras />);
    expect(screen.container.textContent).toContain("remember their state across reloads");
  });

  it("documents the marker mode toolbar toggle", async () => {
    const screen = await render(<TimelineExtras />);
    expect(screen.container.textContent).toContain("drops a custom snap point");
  });
});
