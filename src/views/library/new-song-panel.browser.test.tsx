import { usePersistence } from "@/hooks/usePersistence";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { projectFileFrom } from "@/lib/project-file";
import { loadProjectRecord } from "@/lib/project-storage";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { LocationProbe } from "@/test/location-probe";
import { saveInputTitled, seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { NewSongPanel } from "@/views/library/new-song-panel";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dX3k_QDnzHE";
const LOAD_ERROR_MESSAGE = "Could not load that video. Try again.";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

async function renderPanel() {
  return render(
    <>
      <NewSongPanel />
      <LocationProbe />
      <Toaster />
    </>,
    { withRouter: true },
  );
}

// -- Tests --------------------------------------------------------------------

describe("NewSongPanel", () => {
  it("starts a dropped or chosen file in a new project and opens the editor", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    await restoreOpenProject();
    const screen = await renderPanel();
    await userEvent.upload(screen.getByLabelText("Upload audio or project file"), createAudioFile("bravo.wav"));
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(openProjectIdSnapshot()).not.toBe("a");
    await expect
      .poll(() => {
        const source = useAudioStore.getState().source;
        return source?.type === "file" ? source.file.name : null;
      })
      .toBe("bravo.wav");
    expect(useProjectStore.getState().metadata.title).toBe("bravo");
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  it("starts a pasted YouTube link in a new project from the keyboard, with no toast", async () => {
    const screen = await renderPanel();
    const field = screen.getByRole("textbox", { name: "Or paste a YouTube link" });
    await field.click();
    await userEvent.keyboard(`https://www.youtube.com/watch?v=${VIDEO_ID}{Enter}`);
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    const source = useAudioStore.getState().source;
    expect(source?.type === "youtube" ? source.videoId : null).toBe(VIDEO_ID);
    expect(openProjectIdSnapshot()).toBeDefined();
    expect(screen.container.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("imports a project file and opens it", async () => {
    const screen = await renderPanel();
    const file = new File(
      [JSON.stringify(projectFileFrom(undefined, storedProject(songTitled("Imported"))))],
      "x.json",
    );
    await userEvent.upload(screen.getByLabelText("Import project file"), file);
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(useProjectStore.getState().metadata.title).toBe("Imported");
  });

  it("opens a TTML document saved under a project file name as a new project and saves it", async () => {
    await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
    const screen = await render(
      <>
        <PersistenceHost />
        <NewSongPanel />
        <LocationProbe />
        <Toaster />
      </>,
      { withRouter: true },
    );
    await getPersistenceSettled();
    expect(openProjectIdSnapshot()).toBe("a");
    const ttml =
      '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:title>Cynic</ttm:title></metadata></head><body><div><p begin="0:01.458" end="0:03.324"><span begin="0:01.458" end="0:02.000">今</span><span begin="0:02.000" end="0:03.324">は</span></p></div></body></tt>';
    await userEvent.upload(
      screen.getByLabelText("Import project file"),
      new File([ttml], "Cynic.ttml-project.ttml-project.json", { type: "application/json" }),
    );
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(useProjectStore.getState().metadata.title).toBe("Cynic");
    expect(useProjectStore.getState().lines[0]?.words?.map((word) => word.text)).toEqual(["今", "は"]);
    const newId = openProjectIdSnapshot();
    expect(newId).toBeDefined();
    expect(newId).not.toBe("a");
    await flushPendingSave();
    await expect.poll(async () => (await loadProjectRecord(newId ?? ""))?.metadata.title).toBe("Cynic");
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
  });

  it("imports a project file dropped or chosen in the drop zone and opens it", async () => {
    const screen = await renderPanel();
    const file = new File(
      [JSON.stringify(projectFileFrom(undefined, storedProject(songTitled("Dropped in"))))],
      "dropped.ttml-project.json",
      { type: "application/json" },
    );
    await userEvent.upload(screen.getByLabelText("Upload audio or project file"), file);
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    expect(useProjectStore.getState().metadata.title).toBe("Dropped in");
    expect(useAudioStore.getState().source).toBeNull();
  });

  it("says the drop zone takes project files too", async () => {
    const screen = await renderPanel();
    await expect.element(screen.getByText("Drop an audio or project file, or choose one")).toBeInTheDocument();
    await expect.element(screen.getByText("MP3, WAV, M4A, OGG, FLAC", { exact: true })).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("says so and stays on the library when a project file dropped in the drop zone is broken", async () => {
      allowConsole(/could not read the project file/);
      const screen = await renderPanel();
      await userEvent.upload(
        screen.getByLabelText("Upload audio or project file"),
        new File(["not json"], "broken.json", { type: "application/json" }),
      );
      await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
      expect(openProjectIdSnapshot()).toBeUndefined();
    });

    it("keeps Create disabled until something is typed", async () => {
      const screen = await renderPanel();
      await expect.element(screen.getByRole("button", { name: "Create" })).toBeDisabled();
      await expect.element(screen.getByText("Each song gets its own project.")).toBeInTheDocument();
    });
  });

  describe("error paths", () => {
    it("explains an invalid link and creates nothing", async () => {
      const screen = await renderPanel();
      await screen.getByRole("textbox", { name: "Or paste a YouTube link" }).fill("not a link");
      await screen.getByRole("button", { name: "Create" }).click();
      await expect.element(screen.getByText("That doesn't look like a valid YouTube URL or ID")).toBeInTheDocument();
      expect(openProjectIdSnapshot()).toBeUndefined();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
    });

    it("deletes a failed video start, returns to the library and says why", async () => {
      const screen = await renderPanel();
      const field = screen.getByRole("textbox", { name: "Or paste a YouTube link" });
      await field.click();
      await userEvent.keyboard(`${VIDEO_ID}{Enter}`);
      const newId = openProjectIdSnapshot();
      expect(newId).toBeDefined();
      debouncedSave(saveInputTitled(VIDEO_ID));
      await flushPendingSave();
      expect(await loadProjectRecord(newId ?? "")).toBeDefined();

      useAudioStore.getState().failYouTubeLoad(LOAD_ERROR_MESSAGE);

      await expect.element(screen.getByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
      expect(openProjectIdSnapshot()).not.toBe(newId);
      expect(await loadProjectRecord(newId ?? "")).toBeUndefined();
    });

    it("says so and stays on the library when the imported file is invalid", async () => {
      allowConsole(/could not read the project file/);
      const screen = await renderPanel();
      await userEvent.upload(screen.getByLabelText("Import project file"), new File(["not json"], "broken.json"));
      await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
    });

    it("ignores a non-audio file and starts nothing", async () => {
      const screen = await renderPanel();
      await userEvent.upload(
        screen.getByLabelText("Upload audio or project file"),
        new File(["hello"], "notes.txt", { type: "text/plain" }),
      );
      expect(openProjectIdSnapshot()).toBeUndefined();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
    });
  });

  describe("invariants", () => {
    it("keeps one persistent aria-live hint region instead of mounting role=alert", async () => {
      const screen = await renderPanel();
      const hint = screen.getByText("Each song gets its own project.").element();
      expect(hint.getAttribute("aria-live")).toBe("polite");
      await screen.getByRole("textbox", { name: "Or paste a YouTube link" }).fill("not a link");
      await screen.getByRole("button", { name: "Create" }).click();
      await expect.poll(() => hint.textContent).toBe("That doesn't look like a valid YouTube URL or ID");
      expect(hint.getAttribute("aria-live")).toBe("polite");
      expect(hint.getAttribute("role")).toBeNull();
      expect(document.body.contains(hint)).toBe(true);
    });
  });
});
