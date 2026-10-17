import { render } from "@/test/render";
import { SyncedBadge } from "@/ui/projects/synced-badge";
import { describe, expect, it } from "vitest";

describe("SyncedBadge", () => {
  it("shows an icon-only badge by default", async () => {
    const screen = await render(<SyncedBadge />);
    await expect.element(screen.getByRole("img", { name: "Synced" })).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("Synced");
  });

  it("shows the label when asked", async () => {
    const screen = await render(<SyncedBadge withLabel />);
    await expect.element(screen.getByText("Synced")).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("merges an extra className onto the icon-only badge", async () => {
      const screen = await render(<SyncedBadge className="justify-self-end" />);
      await expect.element(screen.getByRole("img", { name: "Synced" })).toHaveClass("justify-self-end");
    });
  });
});
