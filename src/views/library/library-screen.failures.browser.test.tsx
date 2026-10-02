import { PROJECT_RECORD_STORE_NAME, deleteFromStore } from "@/lib/persistence-idb";
import { allowConsole } from "@/test/console-guard";
import { LocationProbe } from "@/test/location-probe";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { LibraryScreen } from "@/views/library/library-screen";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const downloads: string[] = [];
const downloadObserver = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) if (node instanceof HTMLAnchorElement) downloads.push(node.download);
  }
});

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

function loseRecord(id: string): Promise<void> {
  return deleteFromStore(PROJECT_RECORD_STORE_NAME, id);
}

beforeEach(async () => {
  allowConsole(/WebGL is not available/);
  allowConsole(/\[Library\]/);
  downloads.length = 0;
  downloadObserver.observe(document.body, { childList: true });
  const now = Date.now();
  await seedStoredProject("alpha", { project: { ...songTitled("Alpha"), savedAt: now - 60_000 } });
  await seedStoredProject("bravo", { project: { ...songTitled("Bravo"), savedAt: now - 2 * 60_000 } });
});

afterEach(() => {
  downloadObserver.disconnect();
});

// -- Tests --------------------------------------------------------------------

describe("LibraryScreen · failures", () => {
  describe("error paths", () => {
    it("says so when a project can no longer be opened", async () => {
      const screen = await renderLibrary();
      await loseRecord("alpha");
      await screen.getByRole("button", { name: "Alpha", exact: true }).click();
      await expect.element(screen.getByText("Couldn't open that project")).toBeInTheDocument();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
    });

    it("says so when a rename fails", async () => {
      const screen = await renderLibrary();
      await loseRecord("alpha");
      await screen.getByRole("button", { name: "More actions for Alpha" }).click();
      await screen.getByRole("menuitem", { name: "Rename" }).click();
      await userEvent.keyboard("Renamed{Enter}");
      await expect.element(screen.getByText("Couldn't rename that project")).toBeInTheDocument();
    });

    it("says so when a duplicate fails", async () => {
      const screen = await renderLibrary();
      await loseRecord("alpha");
      await screen.getByRole("button", { name: "More actions for Alpha" }).click();
      await screen.getByRole("menuitem", { name: "Duplicate" }).click();
      await expect.element(screen.getByText("Couldn't duplicate that project")).toBeInTheDocument();
      await expect.element(screen.getByRole("button", { name: "Alpha copy", exact: true })).not.toBeInTheDocument();
    });

    it("says so when an export fails", async () => {
      const screen = await renderLibrary();
      await loseRecord("alpha");
      await screen.getByRole("button", { name: "More actions for Alpha" }).click();
      await screen.getByRole("menuitem", { name: "Export project file" }).click();
      await expect.element(screen.getByText("Couldn't export that project")).toBeInTheDocument();
      expect(downloads).toEqual([]);
    });

    it("keeps the files already exported when a later one in a bulk export fails", async () => {
      const screen = await renderLibrary();
      await loseRecord("bravo");
      await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
      await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
      await screen.getByRole("button", { name: "Export" }).click();
      await expect.element(screen.getByText("Couldn't export those projects")).toBeInTheDocument();
      expect(downloads).toEqual([expect.stringMatching(/^Alpha-/)]);
    });

    it("still exports the later files when an earlier one in a bulk export fails", async () => {
      const screen = await renderLibrary();
      await loseRecord("alpha");
      await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
      await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
      await screen.getByRole("button", { name: "Export" }).click();
      await expect.element(screen.getByText("Couldn't export those projects")).toBeInTheDocument();
      expect(downloads).toEqual([expect.stringMatching(/^Bravo-/)]);
    });
  });
});
