import { render } from "@/test/render";
import { SegmentedControl } from "@/ui/segmented-control";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";
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

  describe("disabled options", () => {
    const withDisabledWord = [
      { value: "line", label: "Line" },
      { value: "word", label: "Word", disabled: true },
    ] as const;

    it("disables an option marked disabled", async () => {
      const screen = await render(
        <SegmentedControl aria-label="Granularity" value="line" options={withDisabledWord} onChange={() => {}} />,
      );
      await expect.element(screen.getByRole("button", { name: "Word" })).toBeDisabled();
      await expect.element(screen.getByRole("button", { name: "Line" })).toBeEnabled();
    });

    it("never reports a disabled option", async () => {
      const changes: string[] = [];
      const screen = await render(
        <SegmentedControl
          aria-label="Granularity"
          value="line"
          options={withDisabledWord}
          onChange={(value) => changes.push(value)}
        />,
      );
      await screen.getByRole("button", { name: "Word" }).click({ force: true });
      expect(changes).toEqual([]);
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

  describe("icons and counts", () => {
    it("names an icon-only option by its label", async () => {
      const screen = await render(
        <SegmentedControl
          aria-label="View"
          value="list"
          onChange={() => {}}
          options={[
            { value: "list", label: "List view", icon: IconList, iconOnly: true },
            { value: "grid", label: "Grid view", icon: IconLayoutGrid, iconOnly: true },
          ]}
        />,
      );
      await expect.element(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: "List view" }).element().textContent).toBe("");
    });

    it("shows a count after the label and includes it in the name", async () => {
      const screen = await render(
        <SegmentedControl
          aria-label="Filter by progress"
          value="all"
          onChange={() => {}}
          options={[
            { value: "all", label: "All", count: 24 },
            { value: "synced", label: "Synced", count: 12 },
          ]}
        />,
      );
      await expect.element(screen.getByRole("button", { name: "Synced 12" })).toBeInTheDocument();
      await expect.element(screen.getByText("12")).toBeInTheDocument();
    });

    it("changes the value from the keyboard", async () => {
      const changes: string[] = [];
      const screen = await render(
        <SegmentedControl
          aria-label="View"
          value="list"
          onChange={(value) => changes.push(value)}
          options={[
            { value: "list", label: "List view", icon: IconList, iconOnly: true },
            { value: "grid", label: "Grid view", icon: IconLayoutGrid, iconOnly: true },
          ]}
        />,
      );
      await userEvent.keyboard("{Tab}{Tab}{Enter}");
      expect(changes).toEqual(["grid"]);
      expect(screen.getByRole("button", { name: "Grid view" }).element()).toBe(document.activeElement);
    });
  });
});
