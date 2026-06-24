import { describe, expect, it } from "vitest";
import { Select } from "@/ui/select";
import { render } from "@/test/render";

// -- Fixtures -----------------------------------------------------------------

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

// -- Tests --------------------------------------------------------------------

describe("Select", () => {
  it("shows the selected option's label on the trigger", async () => {
    const screen = await render(<Select aria-label="Letter" value="b" onChange={() => {}} options={OPTIONS} />);
    await expect.element(screen.getByRole("button", { name: "Letter" })).toHaveTextContent("Beta");
  });

  it("opens the listbox, and selecting an option calls onChange and closes", async () => {
    let selected = "a";
    const screen = await render(
      <Select
        aria-label="Letter"
        value="a"
        onChange={(value) => {
          selected = value;
        }}
        options={OPTIONS}
      />,
    );
    await screen.getByRole("button", { name: "Letter" }).click();
    await expect.element(screen.getByRole("option", { name: "Gamma" })).toBeInTheDocument();
    await screen.getByRole("option", { name: "Gamma" }).click();
    expect(selected).toBe("c");
    await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument();
  });

  it("marks the option matching the current value as selected", async () => {
    const screen = await render(<Select aria-label="Letter" value="b" onChange={() => {}} options={OPTIONS} />);
    await screen.getByRole("button", { name: "Letter" }).click();
    await expect.element(screen.getByRole("option", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("aria-selected", "false");
  });

  it("closes on Escape without selecting", async () => {
    let changes = 0;
    const screen = await render(
      <Select
        aria-label="Letter"
        value="a"
        onChange={() => {
          changes++;
        }}
        options={OPTIONS}
      />,
    );
    await screen.getByRole("button", { name: "Letter" }).click();
    await expect.element(screen.getByRole("listbox")).toBeInTheDocument();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument();
    expect(changes).toBe(0);
  });
});
