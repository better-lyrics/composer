import { useImportFromQuery } from "@/hooks/useImportFromQuery";
import { useImportFromYouTube } from "@/hooks/useImportFromYouTube";
import { usePersistence } from "@/hooks/usePersistence";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { PROJECT_INDEX_STORE_NAME, setInStore } from "@/lib/persistence-idb";
import { getLinkProjectSettled, getPersistenceSettled, getQueryImportSettled } from "@/lib/persistence-settled";
import { indexEntryForProject } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { isProjectDeleted } from "@/lib/project-tombstones";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const LINKED_VIDEO_ID = "dQw4w9WgXcQ";

// -- Helpers ------------------------------------------------------------------

const LinkHost: React.FC = () => {
  usePersistence();
  useImportFromQuery();
  useImportFromYouTube();
  return <Toaster />;
};

const ReversedLinkHost: React.FC = () => {
  usePersistence();
  useImportFromYouTube();
  useImportFromQuery();
  return <Toaster />;
};

function setQuery(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

async function seedOpenAlpha(lyrics = true): Promise<void> {
  await seedStoredProject("a", {
    open: true,
    audio: createAudioFile("alpha.wav"),
    project: {
      ...songTitled("Alpha"),
      ...(lyrics ? {} : { lines: [] }),
      audioSource: { kind: "file", name: "alpha.wav" },
    },
  });
}

async function seedOrphanedVideoIndexEntry(id: string, videoId: string): Promise<void> {
  const project = storedProject({ audioSource: { kind: "youtube", videoId } });
  const entry = indexEntryForProject(id, project, { storedAudioBytes: 0 });
  await setInStore(PROJECT_INDEX_STORE_NAME, id, entry);
}

async function bootWithLink(search: string) {
  setQuery(search);
  const screen = await render(<LinkHost />);
  await getPersistenceSettled();
  const outcome = await getLinkProjectSettled();
  await getQueryImportSettled();
  return { screen, outcome };
}

async function bootWithReversedLink(search: string) {
  setQuery(search);
  const screen = await render(<ReversedLinkHost />);
  await getPersistenceSettled();
  const outcome = await getLinkProjectSettled();
  await getQueryImportSettled();
  return { screen, outcome };
}

// -- Tests --------------------------------------------------------------------

describe("useImportFromYouTube · projects", () => {
  beforeEach(() => setQuery(""));
  afterEach(() => setQuery(""));

  it("reopens the project that already has the linked video", async () => {
    await seedOpenAlpha();
    await seedStoredProject("b", {
      project: { ...songTitled("Bravo"), audioSource: { kind: "youtube", videoId: LINKED_VIDEO_ID } },
    });
    const { outcome } = await bootWithLink(`?v=${LINKED_VIDEO_ID}`);
    expect(outcome).toBe("reopened");
    expect(openProjectIdSnapshot()).toBe("b");
    expect(useProjectStore.getState().metadata.title).toBe("Bravo");
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  it("opens a new project when no project has the video and the open one has lyrics", async () => {
    await seedOpenAlpha();
    const { outcome } = await bootWithLink(`?v=${LINKED_VIDEO_ID}`);
    expect(outcome).toBe("created");
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(useProjectStore.getState().lines).toEqual([]);
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  it("shows the Better Lyrics toast with the link's title, and Switch back returns", async () => {
    await seedOpenAlpha();
    const { screen } = await bootWithLink(`?title=Blinding%20Lights&artist=The%20Weeknd&videoId=${LINKED_VIDEO_ID}`);
    useAudioStore.getState().setYouTubeFile(createAudioFile(`${LINKED_VIDEO_ID}.opus`));
    await expect.element(screen.getByText("Opened “Blinding Lights” from Better Lyrics")).toBeInTheDocument();
    await expect.element(screen.getByText("New project. “Alpha” is still in Projects.")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Switch back" }).click();
    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
  });

  it("rolls back the created project when the linked video fails to load", async () => {
    allowConsole(/the linked video did not load/);
    const warn = vi.spyOn(console, "warn");
    await seedOpenAlpha();
    const { screen } = await bootWithLink(`?title=Blinding%20Lights&videoId=${LINKED_VIDEO_ID}`);
    const newId = openProjectIdSnapshot();
    expect(newId).not.toBe("a");

    useAudioStore.getState().failYouTubeLoad("Could not load that video. Try again.");

    await expect.poll(openProjectIdSnapshot).toBe("a");
    expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    await expect.poll(() => isProjectDeleted(newId ?? "")).toBe(true);
    await expect.element(screen.getByText("Opened “Blinding Lights” from Better Lyrics")).not.toBeInTheDocument();
    expect(warn.mock.calls.some((args) => args.includes("the linked video did not load"))).toBe(true);
    warn.mockRestore();
  });

  it("a new project takes the link's metadata without the replace prompt", async () => {
    await seedOpenAlpha();
    await bootWithLink(`?title=Blinding%20Lights&artist=The%20Weeknd&videoId=${LINKED_VIDEO_ID}`);
    expect(useConfirmStore.getState().isOpen).toBe(false);
    expect(useProjectStore.getState().metadata.title).toBe("Blinding Lights");
    expect(useProjectStore.getState().metadata.artists).toEqual(["The Weeknd"]);
  });

  describe("edge cases", () => {
    it("a reopened project keeps its own metadata and shows no prompt", async () => {
      await seedOpenAlpha();
      await seedStoredProject("b", {
        project: { ...songTitled("Bravo"), audioSource: { kind: "youtube", videoId: LINKED_VIDEO_ID } },
      });
      await bootWithLink(`?title=Other%20Title&videoId=${LINKED_VIDEO_ID}`);
      expect(useConfirmStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().metadata.title).toBe("Bravo");
    });

    it("an open project without lyrics is reused for the link", async () => {
      await seedOpenAlpha(false);
      const { outcome } = await bootWithLink(`?v=${LINKED_VIDEO_ID}`);
      expect(outcome).toBe("current");
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe(LINKED_VIDEO_ID);
    });

    it("the link to the open project's own video reopens it without a prompt", async () => {
      await seedStoredProject("a", {
        open: true,
        project: { ...songTitled("Alpha"), audioSource: { kind: "youtube", videoId: LINKED_VIDEO_ID } },
      });
      const { outcome } = await bootWithLink(`?v=${LINKED_VIDEO_ID}`);
      expect(outcome).toBe("reopened");
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    });

    it("a link carrying metadata for the open project's own video does not prompt or overwrite it", async () => {
      await seedStoredProject("a", {
        open: true,
        project: { ...songTitled("Alpha"), audioSource: { kind: "youtube", videoId: LINKED_VIDEO_ID } },
      });
      await bootWithLink(`?title=Other%20Title&videoId=${LINKED_VIDEO_ID}`);
      expect(useConfirmStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    });

    it("no link param settles as none", async () => {
      await seedOpenAlpha();
      const { outcome } = await bootWithLink("");
      expect(outcome).toBe("none");
      expect(openProjectIdSnapshot()).toBe("a");
    });

    it("waits for the link outcome even when useImportFromYouTube mounts before useImportFromQuery", async () => {
      await seedOpenAlpha();
      await seedStoredProject("b", {
        project: { ...songTitled("Bravo"), audioSource: { kind: "youtube", videoId: LINKED_VIDEO_ID } },
      });
      const { outcome } = await bootWithReversedLink(`?title=Other%20Title&videoId=${LINKED_VIDEO_ID}`);
      expect(outcome).toBe("reopened");
      expect(useConfirmStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().metadata.title).toBe("Bravo");
    });

    it("a broken index entry settles as failed and leaves the open project alone", async () => {
      allowConsole(/could not open the project for the link/);
      await seedOpenAlpha();
      await seedOrphanedVideoIndexEntry("c", LINKED_VIDEO_ID);
      const { outcome } = await bootWithLink(`?title=Other%20Title&videoId=${LINKED_VIDEO_ID}`);
      expect(outcome).toBe("failed");
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useConfirmStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    });
  });
});
