import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { Button } from "@/ui/button";
import { Select } from "@/ui/select";
import { installStyleSheet } from "@/test/browser-css";
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

  it("shows the placeholder on the trigger when the value matches no option", async () => {
    const screen = await render(
      <Select aria-label="Letter" value="" placeholder="Pick one" onChange={() => {}} options={OPTIONS} />,
    );
    await expect.element(screen.getByRole("button", { name: "Letter" })).toHaveTextContent("Pick one");
  });

  it("still selects an option when a placeholder is set", async () => {
    let selected = "";
    const screen = await render(
      <Select
        aria-label="Letter"
        value=""
        placeholder="Pick one"
        onChange={(v) => {
          selected = v;
        }}
        options={OPTIONS}
      />,
    );
    await screen.getByRole("button", { name: "Letter" }).click();
    await screen.getByRole("option", { name: "Beta" }).click();
    expect(selected).toBe("b");
  });

  it("renders a leading color dot on the trigger when leadingColor is set", async () => {
    const screen = await render(
      <Select aria-label="Letter" value="a" leadingColor="rgb(255, 0, 0)" onChange={() => {}} options={OPTIONS} />,
    );
    const trigger = screen.getByRole("button", { name: "Letter" }).element() as HTMLElement;
    const dot = trigger.querySelector("span[style]") as HTMLElement | null;
    expect(dot).not.toBeNull();
    expect(dot?.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("does not open when disabled", async () => {
    const screen = await render(
      <Select aria-label="Letter" value="a" onChange={() => {}} options={OPTIONS} disabled />,
    );
    await expect.element(screen.getByRole("button", { name: "Letter" })).toBeDisabled();
  });

  it("renders a custom trigger and still opens the listbox", async () => {
    let selected = "";
    const screen = await render(
      <Select
        aria-label="Add letter"
        value=""
        onChange={(value) => {
          selected = value;
        }}
        options={OPTIONS}
        trigger={<Button variant="ghost">Add letter</Button>}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Add letter" });
    await expect.element(trigger).toHaveAttribute("aria-haspopup", "listbox");
    await trigger.click();
    await screen.getByRole("option", { name: "Gamma" }).click();
    expect(selected).toBe("c");
  });

  describe("long lists", () => {
    const LONG_OPTIONS = Array.from({ length: 60 }, (_, index) => ({
      value: `o${index + 1}`,
      label: `Option ${index + 1}`,
    }));

    let heightCap: HTMLStyleElement | null = null;

    beforeEach(() => {
      heightCap = installStyleSheet(".max-h-80{max-height:20rem}.overflow-auto{overflow:auto}");
    });

    afterEach(() => {
      heightCap?.remove();
      heightCap = null;
    });

    it("caps the listbox height", async () => {
      const screen = await render(
        <Select aria-label="Language" value="o1" onChange={() => {}} options={LONG_OPTIONS} />,
      );
      await screen.getByRole("button", { name: "Language" }).click();
      const listbox = screen.getByRole("listbox").element();
      await expect
        .poll(() => {
          let node: HTMLElement | null = listbox.parentElement;
          while (node && getComputedStyle(node).maxHeight !== "320px") node = node.parentElement;
          return node?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY;
        })
        .toBeLessThanOrEqual(320);
    });

    it("scrolls the selected option into view when it opens", async () => {
      const screen = await render(
        <Select aria-label="Language" value="o60" onChange={() => {}} options={LONG_OPTIONS} />,
      );
      await screen.getByRole("button", { name: "Language" }).click();
      await expect.element(screen.getByRole("option", { name: "Option 60" })).toBeInViewport();
    });

    it("focuses the selected option when opened by keyboard, and Enter selects it", async () => {
      let selected = "";
      const screen = await render(
        <Select
          aria-label="Language"
          value="o60"
          onChange={(value) => {
            selected = value;
          }}
          options={LONG_OPTIONS}
        />,
      );
      (screen.getByRole("button", { name: "Language" }).element() as HTMLButtonElement).focus();
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByRole("option", { name: "Option 60" })).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      expect(selected).toBe("o60");
    });

    it("focuses the first option when opened by keyboard and no option is selected", async () => {
      const screen = await render(<Select aria-label="Language" value="" onChange={() => {}} options={LONG_OPTIONS} />);
      (screen.getByRole("button", { name: "Language" }).element() as HTMLButtonElement).focus();
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByRole("option", { name: "Option 1", exact: true })).toHaveFocus();
    });
  });
});
