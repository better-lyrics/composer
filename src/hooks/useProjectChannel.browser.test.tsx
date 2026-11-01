import { useProjectChannel } from "@/hooks/useProjectChannel";
import { createProject, openProject, restoreOpenProject } from "@/lib/open-project";
import { forgetOpenProjectId, openProjectIdSnapshot } from "@/lib/open-project-session";
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
import { nanoid } from "nanoid";
import { Toaster, toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const DELETED_NOTICE = "This project was deleted in another tab";

// -- Helpers ------------------------------------------------------------------

const ChannelHost: React.FC = () => {
  useProjectChannel();
  return <Toaster />;
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

function deletedNotices(): number {
  return toast.getToasts().filter((entry) => "title" in entry && entry.title === DELETED_NOTICE).length;
}

async function openAlpha(): Promise<void> {
  await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
  await restoreOpenProject();
}

async function seedBravo(): Promise<void> {
  await seedStoredProject("b", { project: songTitled("Bravo") });
}

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
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
    await expect.element(screen.getByText("This project was deleted in another tab")).toBeInTheDocument();
    await expect.element(screen.getByText("Changes here are not being saved.")).toBeInTheDocument();
  });

  it("Keep as new project saves what is on screen under a new id", async () => {
    await openAlpha();
    const screen = await render(<ChannelHost />);
    await removeProjectData("a");
    deleteInOtherTab(["a"]);
    await expect.element(screen.getByText("This project was deleted in another tab")).toBeInTheDocument();
    useProjectStore.getState().setMetadata({ title: "Alpha (edited)" });
    await screen.getByRole("button", { name: "Keep as new project" }).click();
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
      await render(<ChannelHost />);
      const heard = afterHookHears(1);
      deleteInOtherTab(["b"]);
      await heard;
      expect(deletedNotices()).toBe(0);
    });

    it("Keep as new project adds the kept copy next to the existing projects", async () => {
      await openAlpha();
      const screen = await render(<ChannelHost />);
      deleteInOtherTab(["a"]);
      await screen.getByRole("button", { name: "Keep as new project" }).click();
      await expect.poll(async () => (await listProjectIndex()).length).toBe(2);
    });

    it("shows one toast when the same project is announced deleted twice", async () => {
      const id = nanoid();
      await seedStoredProject(id, { open: true, project: songTitled("Alpha") });
      await restoreOpenProject();
      const screen = await render(<ChannelHost />);
      const heard = afterHookHears(2);
      deleteInOtherTab([id]);
      deleteInOtherTab([id]);
      await heard;
      await expect.element(screen.getByText(DELETED_NOTICE)).toBeInTheDocument();
      expect(deletedNotices()).toBe(1);
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

    it("regression: an unmounted hook no longer dismisses its notice when the open project changes", async () => {
      await openAlpha();
      const screen = await render(<ChannelHost />);
      deleteInOtherTab(["a"]);
      await expect.element(screen.getByText(DELETED_NOTICE)).toBeInTheDocument();
      await screen.unmount();
      forgetOpenProjectId();
      expect(deletedNotices()).toBe(1);
    });

    it("regression: switching away from the deleted project makes Keep as new project a no-op", async () => {
      await openAlpha();
      const screen = await render(<ChannelHost />);
      deleteInOtherTab(["a"]);
      await expect.element(screen.getByRole("button", { name: "Keep as new project" })).toBeInTheDocument();
      createProject();
      useProjectStore.getState().setMetadata({ title: "Should not be saved" });
      const newId = openProjectIdSnapshot();
      findButtonByText(screen.container, "Keep as new project").click();
      expect(openProjectIdSnapshot()).toBe(newId);
      expect(getSaveStatus()).toBe("saved");
      expect(await listProjectIndex()).toHaveLength(1);
    });
  });
});
