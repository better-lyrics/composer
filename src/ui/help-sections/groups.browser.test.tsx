import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { GroupsSection } from "@/ui/help-sections/groups";

describe("GroupsSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<GroupsSection />);
    await expect.element(screen.getByRole("heading", { name: "Creating a group" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<GroupsSection />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("documents conforming lines to an existing group", async () => {
    const screen = await render(<GroupsSection />);
    await expect.element(screen.getByRole("heading", { name: "Adding more instances" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Conform");
    expect(screen.container.textContent).toContain("exactly as long as the group");
    expect(screen.container.textContent).toContain("at the playhead when those lines had no timing yet");
  });
});
