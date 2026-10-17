import { render } from "@/test/render";
import { IconField } from "@/ui/icon-field";
import { Modal } from "@/ui/modal";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const Harness: React.FC = () => {
  const [value, setValue] = useState("");
  return (
    <IconField
      icon={IconSearch}
      aria-label="Search projects"
      placeholder="Search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      trailing={<span>slash</span>}
    />
  );
};

// -- Tests --------------------------------------------------------------------

describe("IconField", () => {
  it("is a labelled text input with its icon hidden from assistive technology", async () => {
    const screen = await render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Search projects" });
    await expect.element(input).toHaveAttribute("placeholder", "Search");
    expect(screen.container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes typed text from the keyboard", async () => {
    const screen = await render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Search projects" });
    await input.click();
    await userEvent.keyboard("m83");
    await expect.element(input).toHaveValue("m83");
  });

  it("renders the trailing content after the input", async () => {
    const screen = await render(<Harness />);
    const trailing = screen.getByText("slash").element();
    const input = screen.getByRole("textbox", { name: "Search projects" }).element();
    expect(input.compareDocumentPosition(trailing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe("regressions", () => {
    it("regression: plain keys typed into the field do not reach window shortcuts", async () => {
      const seen: string[] = [];
      const onKey = (event: KeyboardEvent) => seen.push(event.key);
      window.addEventListener("keydown", onKey);
      const screen = await render(<Harness />);
      await screen.getByRole("textbox", { name: "Search projects" }).click();
      await userEvent.keyboard("/");
      window.removeEventListener("keydown", onKey);
      expect(seen).toEqual([]);
    });

    it("regression: a plain Space does not reach a parent keydown handler", async () => {
      let handledByParent = false;
      const screen = await render(
        <div
          onKeyDown={() => {
            handledByParent = true;
          }}
        >
          <Harness />
        </div>,
      );
      await screen.getByRole("textbox", { name: "Search projects" }).click();
      await userEvent.keyboard(" ");
      expect(handledByParent).toBe(false);
    });

    it("regression: Escape still reaches a window-level shortcut listener", async () => {
      const seen: string[] = [];
      const onKey = (event: KeyboardEvent) => seen.push(event.key);
      window.addEventListener("keydown", onKey);
      const screen = await render(<Harness />);
      await screen.getByRole("textbox", { name: "Search projects" }).click();
      await userEvent.keyboard("{Escape}");
      window.removeEventListener("keydown", onKey);
      expect(seen).toEqual(["Escape"]);
    });

    it("regression: Escape inside the field closes an ancestor Modal", async () => {
      const ModalHarness: React.FC = () => {
        const [isOpen, setIsOpen] = useState(true);
        return (
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Rename">
            <IconField icon={IconSearch} aria-label="Project title" placeholder="Title" />
          </Modal>
        );
      };
      const screen = await render(<ModalHarness />);
      await screen.getByRole("textbox", { name: "Project title" }).click();
      await userEvent.keyboard("{Escape}");
      await expect.element(screen.getByRole("dialog", { name: "Rename" })).not.toBeInTheDocument();
    });
  });
});
