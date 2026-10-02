import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { LocationProbe } from "@/test/location-probe";
import { render } from "@/test/render";
import { seedStoredProject, songTitled } from "@/test/projects";
import { LibraryScreen } from "@/views/library/library-screen";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

async function seedLibrary(): Promise<void> {
  const now = Date.now();
  const timed = createLine({ text: "timed", begin: 1, end: 2 });
  await seedStoredProject("alpha", { project: { ...songTitled("Alpha"), savedAt: now - 3 * 60_000, lines: [timed] } });
  await seedStoredProject("bravo", { project: { ...songTitled("Bravo"), savedAt: now - 60_000, lines: [timed] } });
  await seedStoredProject("charlie", { project: { ...songTitled("Charlie"), savedAt: now - 2 * 60_000, lines: [] } });
}

async function renderLibrary() {
  const screen = await render(
    <>
      <LibraryScreen />
      <LocationProbe />
      <Toaster />
    </>,
    { withRouter: true },
  );
  await expect.poll(rowIds).toEqual(["bravo", "charlie", "alpha"]);
  return screen;
}

function rowIds(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-project-id]")].map((row) => row.dataset.projectId ?? "");
}

function pressRepeatedBackspace(target: Element): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", repeat: true, bubbles: true }));
}

beforeEach(async () => {
  allowConsole(/WebGL is not available/);
  await seedLibrary();
});

// -- Tests --------------------------------------------------------------------

describe("LibraryScreen · keyboard", () => {
  describe("focus after a delete", () => {
    it("Backspace on a focused row moves focus to the next row", async () => {
      const screen = await renderLibrary();
      screen.getByRole("button", { name: "Bravo", exact: true }).element().focus();
      await userEvent.keyboard("{Backspace}");
      await expect.poll(rowIds).toEqual(["charlie", "alpha"]);
      await expect.element(screen.getByRole("button", { name: "Charlie", exact: true })).toHaveFocus();
    });

    it("a bulk delete moves focus to the row after the last deleted one", async () => {
      const screen = await renderLibrary();
      await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
      await screen.getByRole("checkbox", { name: "Select Charlie" }).click();
      await screen.getByRole("toolbar", { name: "Selected projects" }).getByRole("button", { name: "Delete" }).click();
      await expect.poll(rowIds).toEqual(["alpha"]);
      await expect.element(screen.getByRole("button", { name: "Alpha", exact: true })).toHaveFocus();
    });

    it("a delete from the row menu moves focus to the next row", async () => {
      const screen = await renderLibrary();
      await screen.getByRole("button", { name: "More actions for Bravo" }).click();
      await screen.getByRole("menuitem", { name: "Delete" }).click();
      await expect.poll(rowIds).toEqual(["charlie", "alpha"]);
      await expect.element(screen.getByRole("button", { name: "Charlie", exact: true })).toHaveFocus();
    });

    describe("edge cases", () => {
      it("deleting the last row moves focus to the search field", async () => {
        const screen = await renderLibrary();
        screen.getByRole("button", { name: "Alpha", exact: true }).element().focus();
        await userEvent.keyboard("{Backspace}");
        await expect.poll(rowIds).toEqual(["bravo", "charlie"]);
        await expect.element(screen.getByRole("textbox", { name: "Search projects" })).toHaveFocus();
      });
    });
  });

  describe("Escape", () => {
    it("closing the sort menu with Escape keeps the selection", async () => {
      const screen = await renderLibrary();
      await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
      await screen.getByRole("button", { name: "Sort: Last edited" }).click();
      await expect.element(screen.getByRole("option", { name: "Title" })).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expect.element(screen.getByRole("option", { name: "Title" })).not.toBeInTheDocument();
      await expect.element(screen.getByRole("toolbar", { name: "Selected projects" })).toBeInTheDocument();
    });
  });

  describe("guards", () => {
    it("Backspace in the search field edits the query instead of deleting", async () => {
      const screen = await renderLibrary();
      await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
      await screen.getByRole("textbox", { name: "Search projects" }).fill("al");
      await userEvent.keyboard("{Backspace}");
      await expect.element(screen.getByRole("textbox", { name: "Search projects" })).toHaveValue("a");
      await expect.element(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("Backspace does nothing while a dialog is open", async () => {
      const screen = await renderLibrary();
      await screen.getByRole("button", { name: "More actions for Alpha" }).click();
      await screen.getByRole("menuitem", { name: "Rename" }).click();
      await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
      screen.getByRole("button", { name: "Cancel" }).element().focus();
      await userEvent.keyboard("{Backspace}");
      await expect.element(screen.getByRole("dialog")).toBeInTheDocument();
      expect(rowIds()).toEqual(["bravo", "charlie", "alpha"]);
    });

    it("a held Backspace does not delete", async () => {
      const screen = await renderLibrary();
      const row = screen.getByRole("button", { name: "Bravo", exact: true }).element();
      row.focus();
      pressRepeatedBackspace(row);
      await expect.element(screen.getByText("Deleted “Bravo”")).not.toBeInTheDocument();
      expect(rowIds()).toEqual(["bravo", "charlie", "alpha"]);
    });
  });
});
