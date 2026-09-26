import { render } from "@/test/render";
import { SegmentedControl } from "@/ui/segmented-control";
import { useState } from "react";
import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const OPTIONS = [
  { value: "line", label: "Line" },
  { value: "word", label: "Word" },
] as const;

const Harness: React.FC<{ onChange?: (value: "line" | "word") => void }> = ({ onChange }) => {
  const [value, setValue] = useState<"line" | "word">("line");
  return (
    <SegmentedControl
      aria-label="Granularity"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// -- Tests --------------------------------------------------------------------

describe("SegmentedControl", () => {
  it("marks the current option as pressed", async () => {
    const screen = await render(<Harness />);
    await expect.element(screen.getByRole("button", { name: "Line" })).toHaveAttribute("aria-pressed", "true");
    await expect.element(screen.getByRole("button", { name: "Word" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked option's value", async () => {
    const changes: string[] = [];
    const screen = await render(<Harness onChange={(value) => changes.push(value)} />);
    await screen.getByRole("button", { name: "Word" }).click();
    expect(changes).toEqual(["word"]);
    await expect.element(screen.getByRole("button", { name: "Word" })).toHaveAttribute("aria-pressed", "true");
  });

  it("names the group for assistive technology", async () => {
    const screen = await render(<Harness />);
    await expect.element(screen.getByRole("group", { name: "Granularity" })).toBeInTheDocument();
  });

  it("selects an option from the keyboard", async () => {
    const changes: string[] = [];
    const screen = await render(<Harness onChange={(value) => changes.push(value)} />);
    const word = screen.getByRole("button", { name: "Word" });
    (word.element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(changes).toEqual(["word"]);
  });

  describe("edge cases", () => {
    it("still reports a click on the already selected option", async () => {
      const changes: string[] = [];
      const screen = await render(<Harness onChange={(value) => changes.push(value)} />);
      await screen.getByRole("button", { name: "Line" }).click();
      expect(changes).toEqual(["line"]);
    });
  });

  describe("invariants", () => {
    it("keeps exactly one option pressed", async () => {
      const screen = await render(<Harness />);
      await screen.getByRole("button", { name: "Word" }).click();
      const pressed = screen.container.querySelectorAll('button[aria-pressed="true"]');
      expect(pressed).toHaveLength(1);
    });
  });
});
