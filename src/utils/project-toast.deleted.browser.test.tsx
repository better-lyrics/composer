import { hiddenProjectIdsSnapshot, schedulePendingDeletion } from "@/lib/pending-deletions";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { loadProjectRecord } from "@/lib/project-storage";
import { allowConsole } from "@/test/console-guard";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { seedStoredProject } from "@/test/projects";
import { render } from "@/test/render";
import { showDeletedProjectsToast } from "@/utils/project-toast";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const AUTO_CLOSE_WAIT_MS = 9_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("showDeletedProjectsToast", () => {
  it("names a single project and offers Undo", async () => {
    await seedStoredProject("a");
    const screen = await render(<Toaster />);
    showDeletedProjectsToast(["Heat Waves"], schedulePendingDeletion(["a"]));
    await expect.element(screen.getByText("Deleted “Heat Waves”")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Undo" }).click();
    expect(hiddenProjectIdsSnapshot().has("a")).toBe(false);
    expect(await loadProjectRecord("a")).toBeDefined();
  });

  it("counts several projects", async () => {
    const screen = await render(<Toaster />);
    showDeletedProjectsToast(["A", "B", "C"], schedulePendingDeletion(["a", "b", "c"]));
    await expect.element(screen.getByText("Deleted 3 projects")).toBeInTheDocument();
  });

  it("commits the delete when the toast is dismissed", async () => {
    await seedStoredProject("a");
    const screen = await render(<Toaster />);
    showDeletedProjectsToast(["Heat Waves"], schedulePendingDeletion(["a"]));
    await screen.getByRole("button", { name: "Close toast" }).click();
    await expect.poll(() => loadProjectRecord("a")).toBeUndefined();
  });

  it("commits the delete when the toast auto-closes on its own", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    await seedStoredProject("a");
    await render(<Toaster />);
    showDeletedProjectsToast(["Heat Waves"], schedulePendingDeletion(["a"]));
    await vi.advanceTimersByTimeAsync(AUTO_CLOSE_WAIT_MS);
    expect(await loadProjectRecord("a")).toBeUndefined();
  });

  describe("edge cases", () => {
    it("quotes the Untitled fallback for an empty title", async () => {
      const screen = await render(<Toaster />);
      showDeletedProjectsToast([""], schedulePendingDeletion(["a"]));
      await expect.element(screen.getByText("Deleted “Untitled”")).toBeInTheDocument();
    });
  });

  describe("error paths", () => {
    it("shows an error toast and keeps the project visible when the commit fails for one project", async () => {
      allowConsole(/could not delete a project/);
      allowConsole(/could not delete the projects/);
      allowConsole(/blocked/);
      const error = vi.spyOn(console, "error");
      await seedStoredProject("a");
      const screen = await render(<Toaster />);
      showDeletedProjectsToast(["Heat Waves"], schedulePendingDeletion(["a"]));
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await screen.getByRole("button", { name: "Close toast" }).click();
      await expect.element(screen.getByText("Couldn't delete that project")).toBeInTheDocument();
      expect(hiddenProjectIdsSnapshot().has("a")).toBe(false);
      expect(
        error.mock.calls.some((call) => call[0] === "[ProjectToast]" && call[1] === "could not delete the projects"),
      ).toBe(true);
      await deleteDatabase(DB_NAME);
    });

    it("shows an error toast when the commit fails for several projects", async () => {
      allowConsole(/could not delete a project/);
      allowConsole(/could not delete the projects/);
      allowConsole(/blocked/);
      await seedStoredProject("a");
      await seedStoredProject("b");
      const screen = await render(<Toaster />);
      showDeletedProjectsToast(["A", "B"], schedulePendingDeletion(["a", "b"]));
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await screen.getByRole("button", { name: "Close toast" }).click();
      await expect.element(screen.getByText("Couldn't delete some projects")).toBeInTheDocument();
      await deleteDatabase(DB_NAME);
    });
  });
});
