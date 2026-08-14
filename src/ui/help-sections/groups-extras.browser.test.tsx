import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { GroupsExtras } from "@/ui/help-sections/groups-extras";

describe("GroupsExtras", () => {
  it("renders the section content", async () => {
    const screen = await render(<GroupsExtras />);
    await expect.element(screen.getByRole("heading", { name: "Detaching" })).toBeInTheDocument();
  });

  it("separates linked fields from per-instance fields", async () => {
    const screen = await render(<GroupsExtras />);
    await expect.element(screen.getByRole("heading", { name: "What propagates and what doesn't" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Linked across all instances");
    expect(screen.container.textContent).toContain("Stays local to one instance");
  });

  it("documents the three-button split-or-merge prompt", async () => {
    const screen = await render(<GroupsExtras />);
    await expect.element(screen.getByRole("heading", { name: "The split-or-merge prompt" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Apply to all");
    expect(screen.container.textContent).toContain("Detach");
    expect(screen.container.textContent).toContain("Cancel");
  });

  it("documents both ways to break a link", async () => {
    const screen = await render(<GroupsExtras />);
    expect(screen.container.textContent).toContain("Detach this line");
    expect(screen.container.textContent).toContain("Detach instance");
  });

  it("documents emptying an instance and the partial-delete exception", async () => {
    const screen = await render(<GroupsExtras />);
    await expect.element(screen.getByRole("heading", { name: "Emptying an instance" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Partial deletes don't trigger this");
  });

  it("documents the group registry attribute used on export", async () => {
    const screen = await render(<GroupsExtras />);
    await expect.element(screen.getByText(/composer:groups/)).toBeInTheDocument();
  });
});
