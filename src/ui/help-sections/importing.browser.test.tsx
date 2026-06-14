import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { ImportSection } from "@/ui/help-sections/importing";

describe("ImportSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<ImportSection />);
    await expect.element(screen.getByRole("heading", { name: "Audio files" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<ImportSection />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("documents the Composer Bridge as an alternative YouTube backend", async () => {
    const screen = await render(<ImportSection />);
    expect(screen.container.textContent).toContain("Composer Bridge");
    expect(screen.container.textContent).toContain("http://localhost:7777");
  });

  it("links to the composer-bridge repo", async () => {
    const screen = await render(<ImportSection />);
    const link = screen.container.querySelector('a[href="https://github.com/better-lyrics/composer-bridge"]');
    expect(link).not.toBeNull();
  });
});
