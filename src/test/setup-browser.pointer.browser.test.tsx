import { stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Harness ------------------------------------------------------------------

let mouseEnters = 0;

function FullPageTarget() {
  return (
    <div
      data-testid="full-page-target"
      style={{ position: "fixed", inset: 0 }}
      onMouseEnter={() => {
        mouseEnters++;
      }}
    />
  );
}

// -- Tests --------------------------------------------------------------------

describe("browser test setup · pointer", () => {
  it("leaves the cursor resting on the page at the end of a test", async () => {
    const screen = await render(<FullPageTarget />);

    await userEvent.hover(screen.getByTestId("full-page-target"));

    expect(mouseEnters).toBe(1);
  });

  describe("invariants", () => {
    it("starts the next test with the cursor off the page, so nothing new is hovered", async () => {
      mouseEnters = 0;
      await render(<FullPageTarget />);

      await stepFrames(5);

      expect(mouseEnters).toBe(0);
    });
  });
});
