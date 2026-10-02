import { render } from "@/test/render";
import { ProgressBar } from "@/ui/progress-bar";
import { describe, expect, it } from "vitest";

describe("ProgressBar", () => {
  it("exposes its value and label", async () => {
    const screen = await render(<ProgressBar percent={58} label="23 of 38 lines synced, word by word" />);
    const bar = screen.getByRole("progressbar", { name: "23 of 38 lines synced, word by word" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "58");
    await expect.element(bar).toHaveAttribute("aria-valuemin", "0");
    await expect.element(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("fills to the percentage", async () => {
    const screen = await render(<ProgressBar percent={25} label="x" />);
    expect((screen.container.querySelector("[role='progressbar'] > span") as HTMLElement).style.width).toBe("25%");
  });

  describe("edge cases", () => {
    it("uses the on-media colors for the resume card", async () => {
      const screen = await render(<ProgressBar percent={0} label="x" tone="on-media" />);
      await expect.element(screen.getByRole("progressbar")).toHaveClass("h-1.5");
    });

    it("clamps a percent above 100 to a full bar", async () => {
      const screen = await render(<ProgressBar percent={140} label="x" />);
      const bar = screen.getByRole("progressbar");
      await expect.element(bar).toHaveAttribute("aria-valuenow", "100");
      expect((screen.container.querySelector("[role='progressbar'] > span") as HTMLElement).style.width).toBe("100%");
    });

    it("clamps a negative percent to an empty bar", async () => {
      const screen = await render(<ProgressBar percent={-20} label="x" />);
      const bar = screen.getByRole("progressbar");
      await expect.element(bar).toHaveAttribute("aria-valuenow", "0");
      expect((screen.container.querySelector("[role='progressbar'] > span") as HTMLElement).style.width).toBe("0%");
    });
  });
});
