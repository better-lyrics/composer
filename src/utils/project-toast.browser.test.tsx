import { createProject, restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { isProjectDeleted } from "@/lib/project-tombstones";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { seedStoredProject, songTitled } from "@/test/projects";
import { showLinkedProjectToast, showNewProjectToast } from "@/utils/project-toast";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function openAlphaThenCreateNewProject(): Promise<string> {
  await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
  await restoreOpenProject();
  return createProject();
}

// -- Tests --------------------------------------------------------------------

describe("showNewProjectToast", () => {
  it("keeps the new project when Switch back is clicked and it has lyrics", async () => {
    const newId = await openAlphaThenCreateNewProject();
    useProjectStore.getState().setLines([createLine({ text: "New words" })]);
    const screen = await render(<Toaster />);
    showNewProjectToast("b-side", "Alpha", "a", newId);
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(await isProjectDeleted(newId)).toBe(false);
  });

  it("deletes the new project when Switch back is clicked and it has no lyrics", async () => {
    const newId = await openAlphaThenCreateNewProject();
    const screen = await render(<Toaster />);
    showNewProjectToast("b-side", "Alpha", "a", newId);
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    await expect.poll(() => isProjectDeleted(newId)).toBe(true);
  });

  it("uses the id given by the caller, not whatever project happens to be open when the toast shows", async () => {
    const newId = await openAlphaThenCreateNewProject();
    const decoy = createProject();
    const screen = await render(<Toaster />);
    showNewProjectToast("b-side", "Alpha", "a", newId);
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(await isProjectDeleted(decoy)).toBe(false);
    expect(await isProjectDeleted(newId)).toBe(false);
  });

  describe("edge cases", () => {
    it("does not delete anything when the user switched to a different project before clicking Switch back", async () => {
      const newId = await openAlphaThenCreateNewProject();
      const screen = await render(<Toaster />);
      showNewProjectToast("b-side", "Alpha", "a", newId);
      const elsewhere = createProject();
      await screen.getByRole("button", { name: "Switch back" }).click();
      await expect.poll(openProjectIdSnapshot).toBe("a");
      expect(await isProjectDeleted(newId)).toBe(false);
      expect(await isProjectDeleted(elsewhere)).toBe(false);
    });
  });
});

describe("showLinkedProjectToast", () => {
  it("shows the Better Lyrics copy and deletes the new project on Switch back when it has no lyrics", async () => {
    const newId = await openAlphaThenCreateNewProject();
    const screen = await render(<Toaster />);
    showLinkedProjectToast("Blinding Lights", "Alpha", "a", newId);
    await expect.element(screen.getByText("Opened “Blinding Lights” from Better Lyrics")).toBeInTheDocument();
    await expect.element(screen.getByText("New project. “Alpha” is still in Projects.")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    await expect.poll(() => isProjectDeleted(newId)).toBe(true);
  });

  it("keeps the new project on Switch back when it has lyrics", async () => {
    const newId = await openAlphaThenCreateNewProject();
    useProjectStore.getState().setLines([createLine({ text: "New words" })]);
    const screen = await render(<Toaster />);
    showLinkedProjectToast("Blinding Lights", "Alpha", "a", newId);
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(await isProjectDeleted(newId)).toBe(false);
  });
});
