import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "@/test/render";
import { SearchField } from "@/ui/search-field";

// -- Harness -------------------------------------------------------------------

const Harness: React.FC<{ initial?: string; onValue?: (value: string) => void }> = ({ initial = "", onValue }) => {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <SearchField
      label="Search help"
      value={value}
      inputRef={inputRef}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
};

// -- Tests ---------------------------------------------------------------------

describe("SearchField", () => {
  it("labels the field and uses the label as placeholder", async () => {
    const screen = await render(<Harness />);
    await expect
      .element(screen.getByRole("textbox", { name: "Search help" }))
      .toHaveAttribute("placeholder", "Search help");
  });

  it("reports what is typed", async () => {
    const values: string[] = [];
    const screen = await render(<Harness onValue={(value) => values.push(value)} />);
    await screen.getByRole("textbox", { name: "Search help" }).fill("snap");
    expect(values.at(-1)).toBe("snap");
  });

  it("shows the slash hint only while empty", async () => {
    const screen = await render(<Harness />);
    expect(screen.container.querySelector("kbd")?.textContent).toBe("/");
    await screen.getByRole("textbox", { name: "Search help" }).fill("snap");
    await expect.poll(() => screen.container.querySelector("kbd")).toBeNull();
  });

  it("clears from the keyboard and returns focus to the field", async () => {
    const screen = await render(<Harness initial="snap" />);
    (screen.getByRole("button", { name: "Clear search" }).element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("textbox", { name: "Search help" })).toHaveValue("");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search help" }).element());
  });

  describe("edge cases", () => {
    it("keeps whitespace as typed so the caret never jumps", async () => {
      const values: string[] = [];
      const screen = await render(<Harness onValue={(value) => values.push(value)} />);
      await screen.getByRole("textbox", { name: "Search help" }).fill("  snap ");
      expect(values.at(-1)).toBe("  snap ");
    });

    it("offers no clear button while empty", async () => {
      const screen = await render(<Harness />);
      expect(screen.container.querySelector("button")).toBeNull();
    });
  });
});
