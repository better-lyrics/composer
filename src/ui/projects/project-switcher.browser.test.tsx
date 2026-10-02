import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { PROJECT_CHANNEL_NAME } from "@/lib/project-channel";
import {
  DB_NAME,
  DB_VERSION,
  PROJECT_INDEX_STORE_NAME,
  PROJECT_RECORD_STORE_NAME,
  deleteFromStore,
} from "@/lib/persistence-idb";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { LocationProbe } from "@/test/location-probe";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ProjectSwitcher } from "@/ui/projects/project-switcher";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

async function seedLibrary(): Promise<void> {
  await seedStoredProject("a", { open: true, project: { ...songTitled("Alpha"), savedAt: 40 } });
  await seedStoredProject("b", {
    project: {
      metadata: { title: "Bravo", artists: ["The Band"], album: "First", duration: 0 },
      savedAt: 20,
      lines: [createLine({ text: "one", begin: 1, end: 2 }), createLine({ text: "two", begin: 3, end: 4 })],
    },
  });
  await seedStoredProject("c", { project: { ...songTitled("Charlie"), savedAt: 30, lines: [] } });
  await restoreOpenProject();
}

async function renderSwitcher(onClose: () => void = () => undefined) {
  const screen = await render(<ProjectSwitcher onClose={onClose} />, { withRouter: true });
  await expect.element(screen.getByRole("option").first()).toBeInTheDocument();
  return screen;
}

// -- Tests --------------------------------------------------------------------

describe("ProjectSwitcher", () => {
  it("lists the other projects, newest first, and leaves out the open one", async () => {
    await seedLibrary();
    const screen = await renderSwitcher();
    const search = screen.getByRole("combobox", { name: "Search projects" });
    await expect.element(search).toHaveAttribute("aria-expanded", "true");
    const names = screen
      .getByRole("option")
      .elements()
      .map((option) => option.textContent ?? "");
    expect(names).toHaveLength(2);
    expect(names[0]).toContain("Charlie");
    expect(names[1]).toContain("Bravo");
    expect(screen.container.textContent).not.toContain("Alpha");
  });

  it("shows each project's progress", async () => {
    await seedLibrary();
    const screen = await renderSwitcher();
    await expect.element(screen.getByRole("img", { name: "Synced" })).toBeInTheDocument();
    await expect.element(screen.getByText("No lyrics")).toBeInTheDocument();
  });

  it("filters as you type and says when nothing matches", async () => {
    await seedLibrary();
    const screen = await renderSwitcher();
    const search = screen.getByRole("combobox", { name: "Search projects" });
    await search.fill("band");
    await expect.poll(() => screen.getByRole("option").elements().length).toBe(1);
    await search.fill("zzz");
    await expect.element(screen.getByText("No projects match “zzz”")).toBeInTheDocument();
    await expect.element(search).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a project on click and closes", async () => {
    await seedLibrary();
    let closes = 0;
    const screen = await renderSwitcher(() => closes++);
    await screen.getByRole("option", { name: /Bravo/ }).click();
    expect(closes).toBe(1);
    await expect.poll(openProjectIdSnapshot).toBe("b");
    expect(useProjectStore.getState().metadata.title).toBe("Bravo");
  });

  it("starts a new project from the footer", async () => {
    await seedLibrary();
    let closes = 0;
    const screen = await renderSwitcher(() => closes++);
    await screen.getByRole("button", { name: /New project/ }).click();
    expect(closes).toBe(1);
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("");
  });

  it("shows an error toast when opening the chosen project fails", async () => {
    allowConsole(/could not open the project/);
    await seedLibrary();
    await deleteFromStore(PROJECT_RECORD_STORE_NAME, "b");
    const toaster = await render(<Toaster />);
    const screen = await renderSwitcher();
    await screen.getByRole("option", { name: /Bravo/ }).click();
    await expect.element(toaster.getByText("Couldn't open that project")).toBeInTheDocument();
  });

  describe("keyboard", () => {
    it("ArrowDown and ArrowUp move the active option, and Enter opens it", async () => {
      await seedLibrary();
      const screen = await renderSwitcher();
      const search = screen.getByRole("combobox", { name: "Search projects" });
      await search.click();
      const options = screen.getByRole("option");
      await expect.element(options.nth(0)).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{ArrowDown}");
      await expect.element(options.nth(1)).toHaveAttribute("aria-selected", "true");
      await expect
        .element(search)
        .toHaveAttribute("aria-activedescendant", options.nth(1).element().getAttribute("id") ?? "");
      await userEvent.keyboard("{ArrowDown}");
      await expect.element(options.nth(1)).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{ArrowUp}");
      await expect.element(options.nth(0)).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{ArrowDown}{Enter}");
      await expect.poll(openProjectIdSnapshot).toBe("b");
    });

    it("typing resets the active option to the first match", async () => {
      await seedLibrary();
      const screen = await renderSwitcher();
      const search = screen.getByRole("combobox", { name: "Search projects" });
      await search.click();
      await userEvent.keyboard("{ArrowDown}");
      await search.fill("a");
      await expect.element(screen.getByRole("option").nth(0)).toHaveAttribute("aria-selected", "true");
    });

    it("keys typed in the search do not reach window shortcuts", async () => {
      await seedLibrary();
      const screen = await renderSwitcher();
      let windowKeys = 0;
      const count = () => windowKeys++;
      window.addEventListener("keydown", count);
      await screen.getByRole("combobox", { name: "Search projects" }).click();
      await userEvent.keyboard("x");
      window.removeEventListener("keydown", count);
      expect(windowKeys).toBe(0);
    });

    it("Escape closes the switcher itself and never reaches window shortcuts", async () => {
      await seedLibrary();
      let closes = 0;
      const screen = await renderSwitcher(() => closes++);
      let windowKeys = 0;
      const count = () => windowKeys++;
      window.addEventListener("keydown", count);
      await screen.getByRole("combobox", { name: "Search projects" }).click();
      await userEvent.keyboard("{Escape}");
      window.removeEventListener("keydown", count);
      expect(closes).toBe(1);
      expect(windowKeys).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("says there are no other projects when only the open one exists", async () => {
      await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      const screen = await render(<ProjectSwitcher onClose={() => undefined} />, { withRouter: true });
      await expect.element(screen.getByText("No other projects yet")).toBeInTheDocument();
      await expect
        .element(screen.getByRole("combobox", { name: "Search projects" }))
        .toHaveAttribute("aria-expanded", "false");
    });

    it("Enter with no match does nothing", async () => {
      await seedLibrary();
      let closes = 0;
      const screen = await renderSwitcher(() => closes++);
      const search = screen.getByRole("combobox", { name: "Search projects" });
      await search.fill("zzz");
      await userEvent.keyboard("{Enter}");
      expect(closes).toBe(0);
      await expect.poll(openProjectIdSnapshot).toBe("a");
    });
  });

  describe("live updates", () => {
    it("drops a project deleted in another tab", async () => {
      await seedLibrary();
      const screen = await renderSwitcher();
      await expect.poll(() => screen.getByRole("option").elements().length).toBe(2);
      await deleteFromStore(PROJECT_RECORD_STORE_NAME, "c");
      await deleteFromStore(PROJECT_INDEX_STORE_NAME, "c");
      const otherTab = new BroadcastChannel(PROJECT_CHANNEL_NAME);
      otherTab.postMessage({ type: "projects-deleted", ids: ["c"], sender: "another-tab" });
      otherTab.close();
      await expect.poll(() => screen.getByRole("option").elements().length).toBe(1);
      expect(screen.container.textContent).not.toContain("Charlie");
    });

    it("keeps the active row valid when a cross-tab delete shrinks the list past it", async () => {
      await seedLibrary();
      const screen = await renderSwitcher();
      const search = screen.getByRole("combobox", { name: "Search projects" });
      await search.click();
      await userEvent.keyboard("{ArrowDown}");
      await expect.element(screen.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
      await deleteFromStore(PROJECT_RECORD_STORE_NAME, "b");
      await deleteFromStore(PROJECT_INDEX_STORE_NAME, "b");
      const otherTab = new BroadcastChannel(PROJECT_CHANNEL_NAME);
      otherTab.postMessage({ type: "projects-deleted", ids: ["b"], sender: "another-tab" });
      otherTab.close();
      await expect.poll(() => screen.getByRole("option").elements().length).toBe(1);
      await expect.element(screen.getByRole("option").nth(0)).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("regressions", () => {
    it("regression: shows an error when the project index fails to load", async () => {
      allowConsole(/could not load the project index/);
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      const screen = await render(<ProjectSwitcher onClose={() => undefined} />, { withRouter: true });
      await expect.element(screen.getByText("Couldn't load projects")).toBeInTheDocument();
      await deleteDatabase(DB_NAME);
    });
  });

  it("All projects closes the switcher and goes to the library", async () => {
    let closes = 0;
    const screen = await render(
      <>
        <ProjectSwitcher onClose={() => closes++} />
        <LocationProbe />
      </>,
      { withRouter: { initialEntries: ["/editor"] } },
    );
    await screen.getByRole("link", { name: "All projects" }).click();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
    expect(closes).toBe(1);
  });
});
