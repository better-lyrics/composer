import { render } from "@/test/render";
import { ProjectProgress } from "@/ui/projects/project-progress";
import { describe, expect, it } from "vitest";

describe("ProjectProgress", () => {
  it("shows a progress bar for a project that is partly synced", async () => {
    const screen = await render(<ProjectProgress lineCount={4} syncedLineCount={1} />);
    const bar = screen.getByRole("progressbar", { name: "1 of 4 lines synced" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "25");
    await expect.element(bar).toHaveAttribute("aria-valuemin", "0");
    await expect.element(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("shows a check for a synced project", async () => {
    const screen = await render(<ProjectProgress lineCount={4} syncedLineCount={4} />);
    await expect.element(screen.getByRole("img", { name: "Synced" })).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("says No lyrics for a project without lines", async () => {
      const screen = await render(<ProjectProgress lineCount={0} syncedLineCount={0} />);
      await expect.element(screen.getByText("No lyrics")).toBeInTheDocument();
    });

    it("shows an empty bar for a project with lyrics and no timing", async () => {
      const screen = await render(<ProjectProgress lineCount={3} syncedLineCount={0} />);
      await expect.element(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    });

    it("brightens the No lyrics text on an active row", async () => {
      const screen = await render(<ProjectProgress lineCount={0} syncedLineCount={0} isActive />);
      await expect.element(screen.getByText("No lyrics")).toHaveClass("text-composer-text-secondary");
    });
  });
});
