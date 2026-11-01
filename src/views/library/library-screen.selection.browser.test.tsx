import { loadProjectRecord } from "@/lib/project-storage";
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
  await seedStoredProject("bravo", {
    project: { ...songTitled("Bravo"), savedAt: now - 60_000, lines: [timed, createLine({ text: "open" })] },
  });
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
  await expect.poll(rowIds).toHaveLength(3);
  return screen;
}

function rowIds(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-project-id]")].map((row) => row.dataset.projectId ?? "");
}

beforeEach(async () => {
  allowConsole(/WebGL is not available/);
  await seedLibrary();
});

// -- Tests --------------------------------------------------------------------

describe("LibraryScreen · selection", () => {
  it("shows the bulk bar and selects everything shown", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await expect.element(screen.getByText("1 selected")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Select all 3" }).click();
    await expect.element(screen.getByText("3 selected")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
  });

  it("shift-click selects a range", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
    await userEvent.keyboard("{Shift>}");
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await userEvent.keyboard("{/Shift}");
    await expect.element(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("a title click toggles instead of opening while selecting", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await screen.getByRole("button", { name: "Bravo", exact: true }).click();
    await expect.element(screen.getByText("2 selected")).toBeInTheDocument();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
  });

  it("Escape clears the selection", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("toolbar", { name: "Selected projects" })).not.toBeInTheDocument();
  });

  it("deletes at once, and Undo brings the projects back without touching storage", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
    await screen.getByRole("toolbar", { name: "Selected projects" }).getByRole("button", { name: "Delete" }).click();
    await expect.poll(rowIds).toEqual(["charlie"]);
    await expect.element(screen.getByText("Deleted 2 projects")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.poll(rowIds).toEqual(["bravo", "charlie", "alpha"]);
    expect(await loadProjectRecord("alpha")).toBeDefined();
  });

  it("removes the project for good once the toast closes", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await screen.getByRole("toolbar", { name: "Selected projects" }).getByRole("button", { name: "Delete" }).click();
    await screen.getByRole("button", { name: "Close toast" }).click();
    await expect.poll(() => loadProjectRecord("alpha")).toBeUndefined();
    await expect.poll(rowIds).toEqual(["bravo", "charlie"]);
  });

  it("Backspace deletes the selection", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Charlie" }).click();
    await userEvent.keyboard("{Backspace}");
    await expect.element(screen.getByText("Deleted “Charlie”")).toBeInTheDocument();
    await expect.poll(rowIds).toEqual(["bravo", "alpha"]);
  });

  it("a filter that hides a selected project drops it from the selection", async () => {
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await screen.getByRole("button", { name: "Syncing 1" }).click();
    await expect.element(screen.getByRole("toolbar", { name: "Selected projects" })).not.toBeInTheDocument();
  });

  it("exports every selected project", async () => {
    const names: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof HTMLAnchorElement) names.push(node.download);
      }
    });
    observer.observe(document.body, { childList: true });
    const screen = await renderLibrary();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
    await screen.getByRole("button", { name: "Export" }).click();
    await expect.poll(() => names.length).toBe(2);
    observer.disconnect();
  });
});
