import { listProjectIndex } from "@/lib/project-repository";
import { captureDownloads } from "@/test/downloads";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { BackUpAllProjectsSetting, DeleteAllProjectsSetting } from "@/ui/settings/storage/backup-settings-setting";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Tests --------------------------------------------------------------------

describe("BackUpAllProjectsSetting", () => {
  it("renders nothing until the project index resolves, then backs up the stored projects", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await render(<BackUpAllProjectsSetting />);
    expect(screen.container.textContent).toBe("");
    const exportAll = screen.getByRole("button", { name: "Export all" });
    await expect.element(exportAll).toBeEnabled();
    const downloads = captureDownloads();
    (exportAll.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => downloads.names().length).toBe(1);
    downloads.stop();
  });

  describe("edge cases", () => {
    it("disables Export all on a device with no projects", async () => {
      const screen = await render(<BackUpAllProjectsSetting />);
      await expect.element(screen.getByRole("button", { name: "Export all" })).toBeDisabled();
    });
  });
});

describe("DeleteAllProjectsSetting", () => {
  it("counts the stored projects in the confirm and deletes them all", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    await seedStoredProject("c", { project: songTitled("Charlie") });
    const screen = await render(
      <>
        <DeleteAllProjectsSetting />
        <ConfirmModalHost />
      </>,
    );
    await screen.getByRole("button", { name: "Delete all" }).click();
    await expect
      .element(screen.getByText("This removes 3 projects and all stored audio from this device. This can't be undone."))
      .toBeInTheDocument();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete all" }).click();
    await expect.poll(listProjectIndex).toEqual([]);
  });

  describe("edge cases", () => {
    it("disables Delete all on a device with no projects", async () => {
      const screen = await render(<DeleteAllProjectsSetting />);
      await expect.element(screen.getByRole("button", { name: "Delete all" })).toBeDisabled();
    });
  });
});
