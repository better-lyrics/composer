import { useProjectChannel } from "@/hooks/useProjectChannel";
import { createProject, openProject, restoreOpenProject } from "@/lib/open-project";
import { isOpenProjectDeletedElsewhere, keepOpenProjectAsNew } from "@/lib/open-project-deleted";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { PROJECT_CHANNEL_NAME, subscribeProjectsDeleted } from "@/lib/project-channel";
import { listProjectIndex, removeProjectData } from "@/lib/project-repository";
import { buildSaveInput } from "@/lib/project-snapshot";
import { loadProjectRecord } from "@/lib/project-storage";
import { getSaveStatus } from "@/lib/save-status";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { HeaderNotices } from "@/ui/notices/header-notices";
import { DeletedProjectSaveButton } from "@/ui/projects/save-status-label";
import { useDeletedProjectNotice } from "@/ui/projects/use-deleted-project-notice";
import { nanoid } from "nanoid";
import { afterEach, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const DELETED_NOTICE = "This project was deleted in another tab";

// -- Helpers ------------------------------------------------------------------

const ChannelHost: React.FC = () => {
  useProjectChannel();
  return (
    <>
      <HeaderNotices kinds={[useDeletedProjectNotice()]} />
      <DeletedProjectSaveButton />
    </>
  );
};

const openChannels: BroadcastChannel[] = [];

function deleteInOtherTab(ids: string[]): void {
  const channel = new BroadcastChannel(PROJECT_CHANNEL_NAME);
  openChannels.push(channel);
  channel.postMessage({ type: "projects-deleted", ids, sender: "another-tab" });
}

function afterHookHears(count: number): Promise<void> {
  return new Promise((resolve) => {
    let heard = 0;
    const unsubscribe = subscribeProjectsDeleted(() => {
      heard++;
      if (heard < count) return;
      unsubscribe();
      resolve();
    });
  });
}

function deletedNotices(container: HTMLElement): number {
  return Array.from(container.querySelectorAll("span")).filter((span) => span.textContent === DELETED_NOTICE).length;
}

async function openAlpha(): Promise<void> {
  await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
  await restoreOpenProject();
}

async function seedBravo(): Promise<void> {
  await seedStoredProject("b", { project: songTitled("Bravo") });
}

// -- Tests --------------------------------------------------------------------

describe("useProjectChannel", () => {
  afterEach(() => {
    for (const channel of openChannels.splice(0)) channel.close();
  });

  it("warns when the open project is deleted in another tab", async () => {
    await openAlpha();
    const screen = await render(<ChannelHost />);
    deleteInOtherTab(["a"]);
    await expect.element(screen.getByText(DELETED_NOTICE)).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Keep as new project", exact: true })).toBeInTheDocument();
  });

  it("Not saved keeps the work in a new saved project and clears the notice", async () => {
    await openAlpha();
    const screen = await render(<ChannelHost />);
    await removeProjectData("a");
    deleteInOtherTab(["a"]);
    await expect.element(screen.getByText(DELETED_NOTICE)).toBeInTheDocument();
    useProjectStore.getState().setMetadata({ title: "Alpha (kept)" });
    await screen.getByRole("button", { name: "Not saved, keep as new project" }).click();
    await expect.poll(openProjectIdSnapshot).not.toBe("a");
    const id = openProjectIdSnapshot() ?? "";
    await expect.poll(async () => (await loadProjectRecord(id))?.metadata.title).toBe("Alpha (kept)");
    expect(isOpenProjectDeletedElsewhere()).toBe(false);
    await expect.element(screen.getByText(DELETED_NOTICE)).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Not saved, keep as new project" }))
      .not.toBeInTheDocument();
  });

  it("Keep as new project saves what is on screen under a new id", async () => {
    await openAlpha();
    const screen = await render(<ChannelHost />);
    await removeProjectData("a");
    deleteInOtherTab(["a"]);
    await expect.element(screen.getByText("This project was deleted in another tab")).toBeInTheDocument();
    useProjectStore.getState().setMetadata({ title: "Alpha (edited)" });
    await screen.getByRole("button", { name: "Keep as new project", exact: true }).click();
    await expect.poll(openProjectIdSnapshot).not.toBe("a");
    const id = openProjectIdSnapshot() ?? "";
    await expect.poll(async () => (await loadProjectRecord(id))?.metadata.title).toBe("Alpha (edited)");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha (edited)");
  });

  it("cancels a pending save when the open project is deleted in another tab", async () => {
    await openAlpha();
    useSettingsStore.setState({ autoSaveDelay: 60_000 });
    const screen = await render(<ChannelHost />);
    useProjectStore.getState().setMetadata({ title: "Unsaved edit" });
    const args = buildSaveInput();
    if (!args) throw new Error("expected something to save");
    debouncedSave(args);
    deleteInOtherTab(["a"]);
    await expect.element(screen.getByText("This project was deleted in another tab")).toBeInTheDocument();
    await flushPendingSave();
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  describe("edge cases", () => {
    it("stays quiet when another project is deleted", async () => {
      await openAlpha();
      const screen = await render(<ChannelHost />);
      const heard = afterHookHears(1);
      deleteInOtherTab(["b"]);
      await heard;
      expect(deletedNotices(screen.container)).toBe(0);
    });

    it("Keep as new project adds the kept copy next to the existing projects", async () => {
      await openAlpha();
      const screen = await render(<ChannelHost />);
      deleteInOtherTab(["a"]);
      await screen.getByRole("button", { name: "Keep as new project", exact: true }).click();
      await expect.poll(async () => (await listProjectIndex()).length).toBe(2);
    });

    it("shows one notice when the same project is announced deleted twice", async () => {
      const id = nanoid();
      await seedStoredProject(id, { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      const screen = await render(<ChannelHost />);
      const heard = afterHookHears(2);
      deleteInOtherTab([id]);
      deleteInOtherTab([id]);
      await heard;
      await expect.element(screen.getByText(DELETED_NOTICE)).toBeInTheDocument();
      expect(deletedNotices(screen.container)).toBe(1);
    });
  });

  describe("regressions", () => {
    it("regression: switching to another project dismisses the notice for the deleted one", async () => {
      await openAlpha();
      await seedBravo();
      const screen = await render(<ChannelHost />);
      deleteInOtherTab(["a"]);
      await expect.element(screen.getByText("This project was deleted in another tab")).toBeInTheDocument();
      await openProject("b");
      await expect.element(screen.getByText("This project was deleted in another tab")).not.toBeInTheDocument();
    });

    it("regression: switching away from the deleted project makes Keep as new project a no-op", async () => {
      await openAlpha();
      const screen = await render(<ChannelHost />);
      deleteInOtherTab(["a"]);
      await expect
        .element(screen.getByRole("button", { name: "Keep as new project", exact: true }))
        .toBeInTheDocument();
      createProject();
      useProjectStore.getState().setMetadata({ title: "Should not be saved" });
      const newId = openProjectIdSnapshot();
      await expect.element(screen.getByText(DELETED_NOTICE)).not.toBeInTheDocument();
      keepOpenProjectAsNew();
      expect(openProjectIdSnapshot()).toBe(newId);
      expect(getSaveStatus()).toBe("saved");
      expect(await listProjectIndex()).toHaveLength(1);
    });
  });
});
