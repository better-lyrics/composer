import { render } from "@/test/render";
import { StatusChip } from "@/ui/status-chip";
import { IconAlertCircle, IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("StatusChip", () => {
  it("renders its label with the tone's token classes", async () => {
    const screen = await render(
      <StatusChip tone="warning" icon={IconAlertTriangle}>
        Needs review
      </StatusChip>,
    );
    const chip = screen.getByText("Needs review");
    await expect.element(chip).toHaveAttribute("data-tone", "warning");
    await expect.element(chip).toHaveClass("text-composer-warning");
  });

  it("maps error and positive tones to theme tokens", async () => {
    const screen = await render(
      <>
        <StatusChip tone="error" icon={IconAlertCircle}>
          Timing mismatch
        </StatusChip>
        <StatusChip tone="positive" icon={IconCheck}>
          Blank lines kept
        </StatusChip>
      </>,
    );
    await expect.element(screen.getByText("Timing mismatch")).toHaveClass("text-composer-negative");
    await expect.element(screen.getByText("Blank lines kept")).toHaveClass("text-composer-positive");
  });

  it("exposes an accessible label when given one", async () => {
    const screen = await render(
      <StatusChip tone="error" icon={IconAlertCircle} aria-label="2 lines with a timing mismatch">
        2
      </StatusChip>,
    );
    await expect.element(screen.getByLabelText("2 lines with a timing mismatch")).toHaveTextContent("2");
  });

  describe("invariants", () => {
    it("hides the icon from assistive technology", async () => {
      const screen = await render(
        <StatusChip tone="warning" icon={IconAlertTriangle}>
          Needs review
        </StatusChip>,
      );
      const icon = screen.container.querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
    });

    it("merges a className override without losing the tone", async () => {
      const screen = await render(
        <StatusChip tone="positive" icon={IconCheck} className="h-6 text-xs">
          Blank lines kept
        </StatusChip>,
      );
      const chip = screen.getByText("Blank lines kept");
      await expect.element(chip).toHaveClass("h-6");
      await expect.element(chip).not.toHaveClass("h-5");
      await expect.element(chip).toHaveClass("text-composer-positive");
    });
  });
});
