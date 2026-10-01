import { askChoice, useChoiceStore } from "@/stores/choice-store";
import { isAnyModalOpen } from "@/stores/modal-stack";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

function askUseOrOpen() {
  return askChoice({
    title: "Song.ttml-project.json is a project file",
    body: "Use its lyrics in this project, or open it as its own project.",
    options: [
      { value: "open", label: "Open as its own project", variant: "secondary" },
      { value: "use", label: "Use its lyrics here", variant: "primary" },
    ],
  });
}

function askKeepOrReplace() {
  return askChoice({
    title: "Project already in your library",
    body: "Alpha",
    options: [
      { value: "keep-both", label: "Keep both", variant: "secondary" },
      { value: "replace", label: "Replace project", variant: "destructive" },
    ],
  });
}

// -- Tests --------------------------------------------------------------------

describe("ChoiceModalHost", () => {
  it("renders nothing while no choice is asked", async () => {
    const screen = await render(<ChoiceModalHost />);
    expect(screen.container.textContent).toBe("");
    expect(isAnyModalOpen()).toBe(false);
  });

  it("shows the title, the body and every option after Cancel", async () => {
    const screen = await render(<ChoiceModalHost />);
    const pending = askUseOrOpen();
    const dialog = screen.getByRole("alertdialog", { name: "Song.ttml-project.json is a project file" });
    await expect.element(dialog).toBeInTheDocument();
    const labels = [...dialog.element().querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    );
    expect(labels).toEqual(["Close", "Cancel", "Open as its own project", "Use its lyrics here"]);
    await screen.getByRole("button", { name: "Cancel" }).click();
    await expect(pending).resolves.toBe("cancel");
  });

  it("resolves the clicked option and closes", async () => {
    const screen = await render(<ChoiceModalHost />);
    const pending = askUseOrOpen();
    await screen.getByRole("button", { name: "Open as its own project" }).click();
    await expect(pending).resolves.toBe("open");
    await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("wires the body as the dialog description", async () => {
    const screen = await render(<ChoiceModalHost />);
    const pending = askUseOrOpen();
    const dialog = screen.getByRole("alertdialog");
    await expect.element(dialog).toBeInTheDocument();
    const describedById = dialog.element().getAttribute("aria-describedby");
    expect(document.getElementById(describedById as string)?.textContent).toContain("open it as its own project");
    useChoiceStore.getState().answer("cancel");
    await pending;
  });

  describe("focus", () => {
    it("focuses the primary option, so Enter takes it", async () => {
      await render(<ChoiceModalHost />);
      const pending = askUseOrOpen();
      await expect.poll(() => document.activeElement?.textContent).toBe("Use its lyrics here");
      await userEvent.keyboard("{Enter}");
      await expect(pending).resolves.toBe("use");
    });

    it("focuses Cancel when no option is primary, so Enter never runs a destructive one", async () => {
      await render(<ChoiceModalHost />);
      const pending = askKeepOrReplace();
      await expect.poll(() => document.activeElement?.textContent).toBe("Cancel");
      await userEvent.keyboard("{Enter}");
      await expect(pending).resolves.toBe("cancel");
    });
  });

  describe("keyboard", () => {
    it("Escape cancels", async () => {
      const screen = await render(<ChoiceModalHost />);
      const pending = askUseOrOpen();
      await expect.element(screen.getByRole("alertdialog")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expect(pending).resolves.toBe("cancel");
    });

    it("Tab moves from the primary option to the next control inside the dialog", async () => {
      const screen = await render(<ChoiceModalHost />);
      const pending = askUseOrOpen();
      await expect.poll(() => document.activeElement?.textContent).toBe("Use its lyrics here");
      await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
      expect(document.activeElement?.textContent).toBe("Open as its own project");
      expect(screen.getByRole("alertdialog").element().contains(document.activeElement)).toBe(true);
      useChoiceStore.getState().answer("cancel");
      await pending;
    });
  });

  describe("edge cases", () => {
    it("holds one modal entry while open and releases it on answer", async () => {
      const screen = await render(<ChoiceModalHost />);
      const pending = askUseOrOpen();
      await expect.element(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(isAnyModalOpen()).toBe(true);
      useChoiceStore.getState().answer("use");
      await pending;
      await expect.poll(isAnyModalOpen).toBe(false);
    });

    it("offers a single option with Cancel", async () => {
      const screen = await render(<ChoiceModalHost />);
      const pending = askChoice({
        title: "Backup.json is a backup",
        body: "Restore its 3 projects?",
        options: [{ value: "restore", label: "Restore backup", variant: "primary" }],
      });
      await screen.getByRole("button", { name: "Restore backup" }).click();
      await expect(pending).resolves.toBe("restore");
    });
  });
});
