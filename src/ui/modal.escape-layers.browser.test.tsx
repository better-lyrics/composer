import { render } from "@/test/render";
import { Menu, type MenuAnchor, MenuItem } from "@/ui/menu";
import { Modal } from "@/ui/modal";
import { Select } from "@/ui/select";
import { IconPencil } from "@tabler/icons-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

// -- Helpers ------------------------------------------------------------------

const SelectInModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [value, setValue] = useState("a");
  return (
    <Modal isOpen onClose={onClose} title="Song details">
      <Select aria-label="Letter" value={value} onChange={setValue} options={OPTIONS} />
    </Modal>
  );
};

const MenuInModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return (
    <Modal isOpen onClose={onClose} title="Song details">
      <button type="button" onClick={(event) => setAnchor({ kind: "element", element: event.currentTarget })}>
        More
      </button>
      {anchor && (
        <Menu anchor={anchor} onClose={() => setAnchor(null)} aria-label="Song actions">
          <MenuItem icon={IconPencil} label="Rename" onSelect={() => {}} />
        </Menu>
      )}
    </Modal>
  );
};

// -- Tests --------------------------------------------------------------------

describe("Escape with a floating layer open inside a Modal", () => {
  it("regression: closes only the open Select, then the Modal", async () => {
    let modalCloses = 0;
    const screen = await render(<SelectInModal onClose={() => modalCloses++} />);
    await screen.getByRole("button", { name: "Letter" }).click();
    await expect.element(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument();
    expect(modalCloses).toBe(0);
    await userEvent.keyboard("{Escape}");
    expect(modalCloses).toBe(1);
  });

  it("regression: closes only the open Menu, then the Modal", async () => {
    let modalCloses = 0;
    const screen = await render(<MenuInModal onClose={() => modalCloses++} />);
    await screen.getByRole("button", { name: "More" }).click();
    await expect.element(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    expect(modalCloses).toBe(0);
    await userEvent.keyboard("{Escape}");
    expect(modalCloses).toBe(1);
  });
});
