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
});
