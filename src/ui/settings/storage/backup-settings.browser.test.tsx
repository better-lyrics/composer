import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { listProjectIndex } from "@/lib/project-repository";
import { allowConsole } from "@/test/console-guard";
import { captureDownloads } from "@/test/downloads";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { BackUpAllProjectsRow, DeleteAllProjectsRow } from "@/ui/settings/storage/backup-settings";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function renderBackUp(projectCount: number) {
  return render(
    <>
      <BackUpAllProjectsRow projectCount={projectCount} />
      <Toaster />
    </>,
  );
}

function renderDeleteAll(projectCount: number) {
  return render(
    <>
      <DeleteAllProjectsRow projectCount={projectCount} />
      <ConfirmModalHost />
      <Toaster />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("BackUpAllProjectsRow", () => {
  it("downloads every project as one file", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await renderBackUp(1);
    await expect
      .element(screen.getByText("Download every project's lyrics and timings as one file. Audio is not included."))
      .toBeInTheDocument();
    const downloads = captureDownloads();
    await screen.getByRole("button", { name: "Export all" }).click();
    await expect.poll(() => downloads.names().length).toBe(1);
    downloads.stop();
  });

  describe("edge cases", () => {
    it("disables the action with no projects", async () => {
      const screen = await renderBackUp(0);
      await expect.element(screen.getByRole("button", { name: "Export all" })).toBeDisabled();
    });
  });

  describe("error paths", () => {
    it("shows an error toast when the backup fails", async () => {
      allowConsole(/could not back up the projects/);
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await renderBackUp(1);
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await screen.getByRole("button", { name: "Export all" }).click();
      await expect.element(screen.getByText("Couldn't back up your projects")).toBeInTheDocument();
      await deleteDatabase(DB_NAME);
    });
  });
});

describe("DeleteAllProjectsRow", () => {
  it("shows the confirm copy for the project count", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    const screen = await renderDeleteAll(2);
    await expect
      .element(screen.getByText("Remove every project and all stored audio from this device. This can't be undone."))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Delete all" }).click();
    await expect.element(screen.getByText("Delete all projects?")).toBeInTheDocument();
    await expect
      .element(screen.getByText("This removes 2 projects and all stored audio from this device. This can't be undone."))
      .toBeInTheDocument();
  });

  it("deletes every project after confirming", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await renderDeleteAll(1);
    await screen.getByRole("button", { name: "Delete all" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete all" }).click();
    await expect.poll(listProjectIndex).toEqual([]);
    await expect.element(screen.getByText("Deleted all projects")).toBeInTheDocument();
  });

  it("keeps everything when the confirm is cancelled from the keyboard", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await renderDeleteAll(1);
    await screen.getByRole("button", { name: "Delete all" }).click();
    await expect.element(screen.getByText("Delete all projects?")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.getByRole("dialog").elements().length).toBe(0);
    expect((await listProjectIndex()).length).toBe(1);
  });

  describe("edge cases", () => {
    it("disables the action with no projects", async () => {
      const screen = await renderDeleteAll(0);
      await expect.element(screen.getByRole("button", { name: "Delete all" })).toBeDisabled();
    });
  });

  describe("error paths", () => {
    it("shows an error toast when the delete fails", async () => {
      allowConsole(/could not delete the projects/);
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await renderDeleteAll(1);
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      await screen.getByRole("button", { name: "Delete all" }).click();
      await screen.getByRole("dialog").getByRole("button", { name: "Delete all" }).click();
      await expect.element(screen.getByText("Couldn't delete your projects")).toBeInTheDocument();
      await deleteDatabase(DB_NAME);
    });
  });
});
