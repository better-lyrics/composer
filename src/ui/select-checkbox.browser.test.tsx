import { render } from "@/test/render";
import { SelectCheckbox } from "@/ui/select-checkbox";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const Harness: React.FC<{ onRange?: (range: boolean) => void }> = ({ onRange }) => {
  const [checked, setChecked] = useState(false);
  return (
    <SelectCheckbox
      label="Select Heat Waves"
      checked={checked}
      onToggle={(range) => {
        setChecked((value) => !value);
        onRange?.(range);
      }}
    />
  );
};

// -- Tests --------------------------------------------------------------------

describe("SelectCheckbox", () => {
  it("toggles on click", async () => {
    const screen = await render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Select Heat Waves" });
    await box.click();
    await expect.element(box).toBeChecked();
    await box.click();
    await expect.element(box).not.toBeChecked();
  });

  it("reports a shift click as a range toggle", async () => {
    const ranges: boolean[] = [];
    const screen = await render(<Harness onRange={(range) => ranges.push(range)} />);
    const box = screen.getByRole("checkbox", { name: "Select Heat Waves" });
    await box.click();
    await userEvent.keyboard("{Shift>}");
    await box.click();
    await userEvent.keyboard("{/Shift}");
    expect(ranges).toEqual([false, true]);
  });

  it("toggles with Space from the keyboard", async () => {
    const screen = await render(<Harness />);
    await userEvent.keyboard("{Tab}");
    await expect.element(screen.getByRole("checkbox", { name: "Select Heat Waves" })).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect.element(screen.getByRole("checkbox", { name: "Select Heat Waves" })).toBeChecked();
  });

  describe("regressions", () => {
    it("regression: is its own positioning context, so its hit-area pseudo-element cannot expand onto an ancestor", async () => {
      const screen = await render(<Harness />);
      await expect.element(screen.getByRole("checkbox", { name: "Select Heat Waves" })).toHaveClass("relative");
    });
  });

  it("uses the mockup easing curve for the tick", async () => {
    const screen = await render(<Harness />);
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Heat Waves" }))
      .toHaveClass("before:ease-emphasized");
  });
});
