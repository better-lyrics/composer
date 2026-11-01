import { UNSUPPORTED_AUDIO_OR_PROJECT_FILE_MESSAGE } from "@/audio/use-file-drop";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { projectFileFrom } from "@/lib/project-file";
import { PROJECT_FILE_EXTENSIONS_LABEL } from "@/lib/project-file-read";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { dragFile } from "@/test/file-drag";
import { stepFrames } from "@/test/frame-steps";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { ImportPanel } from "@/views/import";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function projectFileTitled(title: string, projectId?: string): File {
  return new File(
    [JSON.stringify(projectFileFrom(projectId, storedProject(songTitled(title))))],
    `${title}.ttml-project.json`,
    { type: "application/json" },
  );
}

async function renderImport() {
  return render(
    <>
      <ImportPanel />
      <ChoiceModalHost />
      <Toaster />
    </>,
  );
}

function importArea(container: HTMLElement): Element {
  const area = container.querySelector('[data-tour="import-dropzone"]');
  if (!area) throw new Error("Import area not rendered");
  return area;
}

function dropBox(container: HTMLElement): HTMLLabelElement {
  const label = container.querySelector<HTMLLabelElement>("label");
  if (!label) throw new Error("Drop box not rendered");
  return label;
}

const openTitle = () => useProjectStore.getState().metadata.title;

// -- Tests --------------------------------------------------------------------

describe("ImportPanel: project files", () => {
  it("opens a project file dropped anywhere on the tab as its own project", async () => {
    useAudioStore.setState({ source: null });
    const before = openProjectIdSnapshot();
    const screen = await renderImport();
    dragFile(importArea(screen.container), "drop", projectFileTitled("Dropped"));
    await expect.poll(openTitle).toBe("Dropped");
    expect(openProjectIdSnapshot()).not.toBe(before);
  });

  it("opens a project file dropped on the box while audio is loaded", async () => {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile("first.wav") } });
    const screen = await renderImport();
    dragFile(dropBox(screen.container), "drop", projectFileTitled("Over audio"));
    await expect.poll(openTitle).toBe("Over audio");
  });

  it("asks what to do when the project is already in the library", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    useAudioStore.setState({ source: null });
    const screen = await renderImport();
    dragFile(importArea(screen.container), "drop", projectFileTitled("Alpha", "a"));
    await expect.element(screen.getByRole("heading", { name: "Project already in your library" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
  });

  it("says so when a dropped project file cannot be read", async () => {
    allowConsole(/could not read the project file/);
    useAudioStore.setState({ source: null });
    const screen = await renderImport();
    dragFile(importArea(screen.container), "drop", new File(["not json"], "broken.ttml-project.json"));
    await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
  });

  it("still loads dropped audio", async () => {
    useAudioStore.setState({ source: null });
    const screen = await renderImport();
    dragFile(importArea(screen.container), "drop", createAudioFile("song.wav"));
    await expect
      .poll(() => {
        const source = useAudioStore.getState().source;
        return source?.type === "file" ? source.file.name : null;
      })
      .toBe("song.wav");
  });

  it("refuses an unsupported file and names project files in the message", async () => {
    useAudioStore.setState({ source: null });
    const screen = await renderImport();
    dragFile(importArea(screen.container), "drop", new File(["x"], "notes.txt", { type: "text/plain" }));
    await expect.element(screen.getByText(UNSUPPORTED_AUDIO_OR_PROJECT_FILE_MESSAGE)).toBeInTheDocument();
    await stepFrames(2);
    expect(useAudioStore.getState().source).toBeNull();
  });

  it("names project files in the drop box and the overlay", async () => {
    useAudioStore.setState({ source: null });
    const screen = await renderImport();
    await expect
      .element(screen.getByText(new RegExp(`project file \\(${PROJECT_FILE_EXTENSIONS_LABEL}\\)`)))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Upload audio or project file").elements()).toHaveLength(1);
    dragFile(importArea(screen.container), "dragenter");
    await expect.element(screen.getByText("Drop to load audio or open a project", { exact: true })).toBeInTheDocument();
  });
});
