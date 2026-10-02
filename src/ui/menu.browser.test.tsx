import { render } from "@/test/render";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { IconCopy, IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const Harness: React.FC<{ onSelect?: (label: string) => void }> = ({ onSelect }) => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          const element = event.currentTarget;
          setAnchor((current) => (current ? null : { kind: "element", element }));
        }}
      >
        More
      </button>
      <button
        type="button"
        onContextMenu={(event) => {
          event.preventDefault();
          setAnchor({ kind: "point", x: event.clientX, y: event.clientY, within: event.currentTarget });
        }}
      >
        Row
      </button>
      <p>Outside</p>
      {anchor && (
        <Menu anchor={anchor} onClose={() => setAnchor(null)} aria-label="Actions for Heat Waves">
          <MenuItem icon={IconPencil} label="Rename" onSelect={() => onSelect?.("Rename")} />
          <MenuItem icon={IconCopy} label="Duplicate" onSelect={() => onSelect?.("Duplicate")} />
          <MenuSeparator />
          <MenuItem icon={IconTrash} label="Delete" tone="danger" onSelect={() => onSelect?.("Delete")} />
        </Menu>
      )}
    </div>
  );
};

// -- Tests --------------------------------------------------------------------

describe("Menu", () => {
  it("opens as a named menu with the first item focused", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "More" }).click();
    const menu = screen.getByRole("menu", { name: "Actions for Heat Waves" });
    await expect.element(menu).toBeInTheDocument();
    await expect.element(menu).toHaveClass("shadow-pop");
    await expect.element(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
  });

  it("moves with the arrow keys, wraps, and selects with Enter", async () => {
    const selected: string[] = [];
    const screen = await render(<Harness onSelect={(label) => selected.push(label)} />);
    await screen.getByRole("button", { name: "More" }).click();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect.element(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(selected).toEqual(["Delete"]);
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("closes on Escape and gives focus back", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "More" }).click();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "More" }).click();
    await screen.getByText("Outside").click();
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  });

  it("opens at the pointer for a right click", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "Row" }).click({ button: "right" });
    await expect.element(screen.getByRole("menu", { name: "Actions for Heat Waves" })).toBeInTheDocument();
  });

  it("marks the danger item", async () => {
    const screen = await render(<Harness />);
    await screen.getByRole("button", { name: "More" }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-composer-negative");
  });

  describe("keyboard", () => {
    it("Home and End jump to the first and last item", async () => {
      const screen = await render(<Harness />);
      await screen.getByRole("button", { name: "More" }).click();
      await userEvent.keyboard("{End}");
      await expect.element(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
      await userEvent.keyboard("{Home}");
      await expect.element(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    });

    it("Tab closes the menu", async () => {
      const screen = await render(<Harness />);
      await screen.getByRole("button", { name: "More" }).click();
      await expect.element(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
      await userEvent.keyboard("{Tab}");
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    });

    it("gives focus back to the opening button after a click on an item", async () => {
      const selected: string[] = [];
      const screen = await render(<Harness onSelect={(label) => selected.push(label)} />);
      await screen.getByRole("button", { name: "More" }).click();
      await screen.getByRole("menuitem", { name: "Duplicate" }).click();
      expect(selected).toEqual(["Duplicate"]);
      await expect.element(screen.getByRole("button", { name: "More" })).toHaveFocus();
    });
  });

  describe("regressions", () => {
    it("regression: clicking the opening button again closes the menu instead of reopening it", async () => {
      const screen = await render(<Harness />);
      await screen.getByRole("button", { name: "More" }).click();
      await expect.element(screen.getByRole("menu")).toBeInTheDocument();
      await screen.getByRole("button", { name: "More" }).click();
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    });
  });
});
