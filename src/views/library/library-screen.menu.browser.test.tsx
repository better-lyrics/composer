import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { allowConsole } from "@/test/console-guard";
import { LocationProbe } from "@/test/location-probe";
import { render } from "@/test/render";
import { seedStoredProject, songTitled } from "@/test/projects";
import { LibraryScreen } from "@/views/library/library-screen";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

async function renderLibrary() {
  const screen = await render(
    <>
      <LibraryScreen />
      <LocationProbe />
      <Toaster />
    </>,
    { withRouter: true },
  );
  await expect.element(screen.getByRole("button", { name: "Alpha", exact: true })).toBeInTheDocument();
  return screen;
}

beforeEach(async () => {
  allowConsole(/WebGL is not available/);
  await seedStoredProject("alpha", { project: { ...songTitled("Alpha"), savedAt: Date.now() - 60_000 } });
  await seedStoredProject("bravo", { project: { ...songTitled("Bravo"), savedAt: Date.now() - 120_000 } });
});

// -- Tests --------------------------------------------------------------------

describe("LibraryScreen · project menu", () => {
  it("renames from the row menu", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "More actions for Alpha" }).click();
    await screen.getByRole("menuitem", { name: "Rename" }).click();
    await expect.element(screen.getByRole("textbox", { name: "Project title" })).toHaveFocus();
    await userEvent.keyboard("Alpha Remix{Enter}");
    await expect.element(screen.getByRole("button", { name: "Alpha Remix", exact: true })).toBeInTheDocument();
  });

  it("duplicates from the row menu", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "More actions for Alpha" }).click();
    await screen.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect.element(screen.getByRole("button", { name: "Alpha copy", exact: true })).toBeInTheDocument();
  });

  it("opens the same menu at the pointer on a right click", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "Bravo", exact: true }).click({ button: "right" });
    await expect.element(screen.getByRole("menu", { name: "Actions for Bravo" })).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(openProjectIdSnapshot()).toBe("bravo");
  });

  it("deletes from the menu with an undo toast", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "More actions for Alpha" }).click();
    await screen.getByRole("menuitem", { name: "Delete" }).click();
    await expect.element(screen.getByText("Deleted “Alpha”")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Alpha", exact: true })).not.toBeInTheDocument();
  });

  it("Backspace on a focused row deletes that project", async () => {
    const screen = await renderLibrary();
    screen.getByRole("button", { name: "Bravo", exact: true }).element().focus();
    await userEvent.keyboard("{Backspace}");
    await expect.element(screen.getByText("Deleted “Bravo”")).toBeInTheDocument();
  });

  it("exports one project file from the menu", async () => {
    const names: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof HTMLAnchorElement) names.push(node.download);
      }
    });
    observer.observe(document.body, { childList: true });
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "More actions for Alpha" }).click();
    await screen.getByRole("menuitem", { name: "Export project file" }).click();
    await expect.poll(() => names).toEqual([expect.stringMatching(/^Alpha-/)]);
    observer.disconnect();
  });
});
