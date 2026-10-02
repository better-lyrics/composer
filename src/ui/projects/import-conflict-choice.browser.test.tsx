import { restoreOpenProject } from "@/lib/open-project";
import { loadProjectAudio } from "@/lib/project-audio";
import { projectFileFrom } from "@/lib/project-file";
import { importProjectFile } from "@/lib/project-import";
import { listProjectIndex } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { seedStoredProject, songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function fileFrom(projectId: string, title: string, lineText: string): File {
  const project = storedProject({
    ...songTitled(title),
    savedAt: 1_758_300_000_000,
    lines: [createLine({ text: lineText })],
  });
  return new File([JSON.stringify(projectFileFrom(projectId, project))], "song.ttml-project.json");
}

async function seedAlpha(open = false): Promise<void> {
  await seedStoredProject("a", {
    open,
    project: {
      ...songTitled("Alpha"),
      audioSource: { kind: "file", name: "alpha.wav" },
      lines: [createLine({ text: "Library line", begin: 1, end: 2 })],
    },
    audio: createAudioFile("alpha.wav"),
  });
}

// -- Tests --------------------------------------------------------------------

describe("import conflict dialog", () => {
  it("compares the file with the library copy", async () => {
    await seedAlpha();
    const screen = await render(<ChoiceModalHost />);
    const pending = importProjectFile(fileFrom("a", "Alpha", "File line"));
    await expect.element(screen.getByRole("heading", { name: "Project already in your library" })).toBeInTheDocument();
    await expect.element(screen.getByText("In the file")).toBeInTheDocument();
    await expect.element(screen.getByText(/^Saved .+, 0 of 1 lines synced$/)).toBeInTheDocument();
    await expect.element(screen.getByText(/^Edited .+, 1 of 1 lines synced$/)).toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
    await expect(pending).resolves.toBeNull();
  });

  it("Keep both imports a copy and leaves the library project alone", async () => {
    await seedAlpha();
    const screen = await render(<ChoiceModalHost />);
    const pending = importProjectFile(fileFrom("a", "Alpha", "File line"));
    await screen.getByRole("button", { name: "Keep both" }).click();
    const id = await pending;
    expect(id).not.toBe("a");
    expect((await loadProjectRecord("a"))?.lines[0]?.text).toBe("Library line");
    expect((await listProjectIndex()).length).toBe(2);
  });

  it("Replace takes the file's lyrics and keeps this device's audio", async () => {
    await seedAlpha();
    const screen = await render(<ChoiceModalHost />);
    const pending = importProjectFile(fileFrom("a", "Alpha", "File line"));
    await screen.getByRole("button", { name: "Replace project" }).click();
    await expect(pending).resolves.toBe("a");
    const record = await loadProjectRecord("a");
    expect(record?.lines[0]?.text).toBe("File line");
    expect(record?.audioSource).toEqual({ kind: "file", name: "alpha.wav" });
    expect((await loadProjectAudio("a"))?.name).toBe("alpha.wav");
  });

  it("Replace on the open project updates the editor at once", async () => {
    await seedAlpha(true);
    await restoreOpenProject();
    const screen = await render(<ChoiceModalHost />);
    const pending = importProjectFile(fileFrom("a", "Alpha", "File line"));
    await screen.getByRole("button", { name: "Replace project" }).click();
    await pending;
    expect(useProjectStore.getState().lines[0]?.text).toBe("File line");
  });

  it("matches a different project id by the same YouTube video, and cancelling writes nothing", async () => {
    await seedStoredProject("v", {
      project: { ...songTitled("Video"), audioSource: { kind: "youtube", videoId: "dX3k_QDnzHE" } },
    });
    const screen = await render(<ChoiceModalHost />);
    const project = storedProject({ ...songTitled("Video"), audioSource: { kind: "youtube", videoId: "dX3k_QDnzHE" } });
    const pending = importProjectFile(new File([JSON.stringify(projectFileFrom("other", project))], "v.json"));
    await expect.element(screen.getByRole("heading", { name: "Project already in your library" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(await pending).toBeNull();
    expect(await listProjectIndex()).toHaveLength(1);
  });

  it("shows the alertdialog role wired to the summary text, focused on Cancel", async () => {
    await seedAlpha();
    const screen = await render(<ChoiceModalHost />);
    const pending = importProjectFile(fileFrom("a", "Alpha", "File line"));
    const dialog = screen.getByRole("alertdialog", { name: "Project already in your library" });
    await expect.element(dialog).toBeInTheDocument();
    const describedById = dialog.element().getAttribute("aria-describedby");
    expect(describedById).not.toBeNull();
    expect(document.getElementById(describedById as string)?.textContent).toContain("In the file");
    await expect.poll(() => document.activeElement?.textContent).toBe("Cancel");
    await screen.getByRole("button", { name: "Cancel" }).click();
    await pending;
  });

  it("Escape cancels from the keyboard", async () => {
    await seedAlpha();
    const screen = await render(<ChoiceModalHost />);
    const pending = importProjectFile(fileFrom("a", "Alpha", "File line"));
    await expect.element(screen.getByRole("button", { name: "Keep both" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(pending).resolves.toBeNull();
    expect((await listProjectIndex()).length).toBe(1);
  });
});
