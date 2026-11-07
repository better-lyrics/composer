import { render } from "@/test/render";
import { BeatGridCorner } from "@/views/timeline/beat-grid/beat-grid-corner";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers -------------------------------------------------------------------

const spacesAtWindow: KeyboardEvent[] = [];
const recordSpace = (e: KeyboardEvent) => {
  if (e.key === " ") spacesAtWindow.push(e);
};

// -- Tests ---------------------------------------------------------------------

describe("BeatGridCorner", () => {
  afterEach(() => {
    window.removeEventListener("keydown", recordSpace);
    spacesAtWindow.length = 0;
  });

  it("regression: lets Space reach the Timeline shortcuts after the popover closes", async () => {
    window.addEventListener("keydown", recordSpace);
    const screen = await render(<BeatGridCorner />);
    const trigger = screen.getByRole("button", { name: "Beat grid" });

    await trigger.click();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => document.activeElement).toBe(trigger.element());

    await userEvent.keyboard(" ");

    expect(spacesAtWindow).toHaveLength(1);
  });
});
