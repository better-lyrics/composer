import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { LocationProbe } from "@/test/location-probe";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
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

function renderLibrary() {
  return render(
    <>
      <LibraryScreen />
      <LocationProbe />
      <Toaster />
    </>,
    { withRouter: true },
  );
}

function rowIds(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-project-id]")].map((row) => row.dataset.projectId ?? "");
}

beforeEach(() => {
  allowConsole(/WebGL is not available/);
});

// -- Tests --------------------------------------------------------------------

describe("LibraryScreen", () => {
  it("shows the most recently edited project on the resume card and every project by last edited", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await expect.element(screen.getByRole("region", { name: "Bravo" })).toBeInTheDocument();
    await expect.element(screen.getByRole("heading", { name: "Projects 3" })).toBeInTheDocument();
    await expect.poll(rowIds).toEqual(["bravo", "charlie", "alpha"]);
  });

  it("filters by stage", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "Synced 1", exact: true }).click();
    await expect.poll(rowIds).toEqual(["alpha"]);
    await screen.getByRole("button", { name: "Not synced 1" }).click();
    await expect.poll(rowIds).toEqual(["charlie"]);
  });

  it("explains a search with no results and clears it", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await screen.getByRole("textbox", { name: "Search projects" }).fill("zzz");
    await expect.element(screen.getByText("No projects match “zzz”")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Clear search" }).click();
    await expect.poll(rowIds).toEqual(["bravo", "charlie", "alpha"]);
  });

  it("starts from the default sort and keeps a changed sort to the session", async () => {
    useSettingsStore.setState({ librarySort: "title" });
    await seedLibrary();
    const screen = await renderLibrary();
    await expect.poll(rowIds).toEqual(["alpha", "bravo", "charlie"]);
    await screen.getByRole("button", { name: "Sort: Title" }).click();
    await screen.getByRole("option", { name: "Last edited" }).click();
    await expect.poll(rowIds).toEqual(["bravo", "charlie", "alpha"]);
    expect(useSettingsStore.getState().librarySort).toBe("title");
  });

  it("the view toggle writes the library view setting", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "Grid view" }).click();
    expect(useSettingsStore.getState().libraryView).toBe("grid");
    await expect.poll(() => document.querySelectorAll("li[data-project-id]").length).toBe(3);
  });

  it("opens a project, then the editor", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "Alpha", exact: true }).click();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(openProjectIdSnapshot()).toBe("alpha");
  });

  it("the resume card opens its project", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "Open project" }).click();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(openProjectIdSnapshot()).toBe("bravo");
  });

  it("focuses the search with / and with the switcher shortcut", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await expect.poll(rowIds).toHaveLength(3);
    await userEvent.keyboard("/");
    await expect.element(screen.getByRole("textbox", { name: "Search projects" })).toHaveFocus();
    screen.getByRole("textbox", { name: "Search projects" }).element().blur();
    await userEvent.keyboard(isMac ? "{Meta>}o{/Meta}" : "{Control>}o{/Control}");
    await expect.element(screen.getByRole("textbox", { name: "Search projects" })).toHaveFocus();
  });

  it("Manage storage opens Save & Storage", async () => {
    await seedLibrary();
    const screen = await renderLibrary();
    await screen.getByRole("button", { name: "Manage storage" }).click();
    expect(useUIStore.getState()).toMatchObject({ settingsOpen: true, settingsSection: "storage" });
  });

  describe("edge cases", () => {
    it("first run goes straight to the editor's Import screen", async () => {
      const screen = await renderLibrary();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    });
  });
});
