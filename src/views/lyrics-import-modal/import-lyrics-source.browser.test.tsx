import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { listProjectIndex } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { PROJECT_FILE_NAME, backupFileNamed, projectFileNamed, projectFileText } from "@/test/project-file-fixtures";
import { seedStoredProject } from "@/test/projects";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { UNSUPPORTED_LYRICS_IMPORT_MESSAGE } from "@/views/lyrics-import-modal/accepted-files";
import type { ImportContext } from "@/views/lyrics-import-modal/import-lyrics";
import { importLyricsFile } from "@/views/lyrics-import-modal/import-lyrics-source";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const TTML_DOCUMENT =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:01.458" end="0:03.324">Now</p></div></body></tt>';

function fileImportContext(): ImportContext {
  return {
    confirm: useConfirmStore.getState().open,
    audioDuration: 0,
    applyBackgroundExtraction: false,
    backgroundExtractionMergeStandalone: false,
    backgroundExtractionPreserveBrackets: false,
    sourceLabel: "File",
    onResult: (parsed, source) => useImportModalStore.getState().recordImportResult(parsed, source),
  };
}

async function renderHosts() {
  return render(
    <>
      <ChoiceModalHost />
      <ConfirmModalHost />
      <Toaster />
    </>,
  );
}

function lineTexts(): string[] {
  return useProjectStore.getState().lines.map((line) => line.text);
}

async function openAlpha(): Promise<void> {
  await seedStoredProject("alpha", {
    open: true,
    project: {
      metadata: { title: "Alpha", artists: [], album: "", duration: 0 },
      lines: [createLine({ text: "Alpha line one" }), createLine({ text: "Alpha line two" })],
    },
  });
  await restoreOpenProject();
}

// -- Tests --------------------------------------------------------------------

describe("importLyricsFile with a project file", () => {
  it("asks how to use the file, naming it", async () => {
    const screen = await renderHosts();
    const pending = importLyricsFile(projectFileNamed(), fileImportContext());
    const dialog = screen.getByRole("alertdialog", { name: `${PROJECT_FILE_NAME} is a Composer project` });
    await expect.element(dialog).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Use its lyrics here" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Open as its own project" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
    await expect(pending).resolves.toBe(false);
  });

  it("Use its lyrics here replaces the lyrics without a second confirm and shows the import result", async () => {
    await openAlpha();
    const screen = await renderHosts();
    const audio = new File([], "alpha.opus", { type: "audio/ogg" });
    useAudioStore.setState({ source: { type: "file", file: audio } });
    const pending = importLyricsFile(projectFileNamed(), fileImportContext());
    await screen.getByRole("button", { name: "Use its lyrics here" }).click();
    await expect(pending).resolves.toBe(true);
    expect(useConfirmStore.getState().isOpen).toBe(false);
    expect(lineTexts()).toEqual(["Climb up the H of the Hollywood sign", "In these stolen moments"]);
    expect(useProjectStore.getState().metadata.title).toBe("Lust for Life");
    expect(useProjectStore.getState().groups.map((group) => group.id)).toEqual(["chorus"]);
    expect(useAudioStore.getState().source).toEqual({ type: "file", file: audio });
    expect(openProjectIdSnapshot()).toBe("alpha");
    expect(useImportModalStore.getState().lastImportResult?.source.filename).toBe(PROJECT_FILE_NAME);
    useProjectStore.getState().undo();
    expect(lineTexts()).toEqual(["Alpha line one", "Alpha line two"]);
  });

  it("Open as its own project switches to the imported project and leaves this one alone", async () => {
    await openAlpha();
    const screen = await renderHosts();
    const pending = importLyricsFile(projectFileNamed(), fileImportContext());
    await screen.getByRole("button", { name: "Open as its own project" }).click();
    await expect(pending).resolves.toBe(true);
    expect(openProjectIdSnapshot()).not.toBe("alpha");
    expect(useProjectStore.getState().metadata.title).toBe("Lust for Life");
    expect((await loadProjectRecord("alpha"))?.lines.map((line) => line.text)).toEqual([
      "Alpha line one",
      "Alpha line two",
    ]);
    expect(await listProjectIndex()).toHaveLength(2);
  });

  it("Cancel leaves the project and the library untouched", async () => {
    await openAlpha();
    const screen = await renderHosts();
    const pending = importLyricsFile(projectFileNamed(), fileImportContext());
    await expect.element(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(pending).resolves.toBe(false);
    expect(lineTexts()).toEqual(["Alpha line one", "Alpha line two"]);
    expect(await listProjectIndex()).toHaveLength(1);
  });

  describe("focus and copy", () => {
    it("focuses Use its lyrics here while this project has no lyrics", async () => {
      await renderHosts();
      const pending = importLyricsFile(projectFileNamed(), fileImportContext());
      await expect.poll(() => document.activeElement?.textContent).toBe("Use its lyrics here");
      await userEvent.keyboard("{Enter}");
      await expect(pending).resolves.toBe(true);
    });

    it("says how many lines a replace would take and focuses Cancel when there are lyrics", async () => {
      await openAlpha();
      const screen = await renderHosts();
      const pending = importLyricsFile(projectFileNamed(), fileImportContext());
      await expect.element(screen.getByText(/replaces your 2 existing lines/)).toBeInTheDocument();
      await expect.poll(() => document.activeElement?.textContent).toBe("Cancel");
      await userEvent.keyboard("{Enter}");
      await expect(pending).resolves.toBe(false);
    });
  });

  describe("backups", () => {
    it("only offers to restore a backup, and restoring keeps this project open", async () => {
      await openAlpha();
      const screen = await renderHosts();
      const backup = backupFileNamed("composer-backup-2026-10-01.ttml-projects.json", ["One", "Two"]);
      const pending = importLyricsFile(backup, fileImportContext());
      const dialog = screen.getByRole("alertdialog", {
        name: "composer-backup-2026-10-01.ttml-projects.json is a Composer backup",
      });
      await expect.element(dialog).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use its lyrics here" }).query()).toBeNull();
      expect(screen.getByRole("button", { name: "Open as its own project" }).query()).toBeNull();
      await screen.getByRole("button", { name: "Restore backup" }).click();
      await expect(pending).resolves.toBe(true);
      await expect.poll(async () => (await listProjectIndex()).length).toBe(3);
      expect(openProjectIdSnapshot()).toBe("alpha");
      expect(lineTexts()).toEqual(["Alpha line one", "Alpha line two"]);
    });

    it("cancelling a backup restores nothing", async () => {
      const screen = await renderHosts();
      const pending = importLyricsFile(backupFileNamed("backup.json", ["One"]), fileImportContext());
      await screen.getByRole("button", { name: "Cancel" }).click();
      await expect(pending).resolves.toBe(false);
      expect(await listProjectIndex()).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("decides by content: a project saved under a .txt name still asks", async () => {
      const screen = await renderHosts();
      const pending = importLyricsFile(new File([projectFileText()], "lyrics.txt"), fileImportContext());
      await expect
        .element(screen.getByRole("alertdialog", { name: "lyrics.txt is a Composer project" }))
        .toBeInTheDocument();
      await screen.getByRole("button", { name: "Cancel" }).click();
      await expect(pending).resolves.toBe(false);
    });

    it("only offers to open a project file that has no lyrics", async () => {
      const screen = await renderHosts();
      const pending = importLyricsFile(projectFileNamed("blank.json", { lines: [] }), fileImportContext());
      await expect.element(screen.getByText(/has no lyrics yet/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use its lyrics here" }).query()).toBeNull();
      await expect.poll(() => document.activeElement?.textContent).toBe("Open as its own project");
      await screen.getByRole("button", { name: "Cancel" }).click();
      await expect(pending).resolves.toBe(false);
    });

    it("imports TTML saved under a .json name as lyrics, with no choice", async () => {
      await renderHosts();
      await expect(importLyricsFile(new File([TTML_DOCUMENT], "song.json"), fileImportContext())).resolves.toBe(true);
      expect(lineTexts()).toEqual(["Now"]);
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    });

    it("keeps importing ordinary lyrics files straight away", async () => {
      await renderHosts();
      const lrc = new File(["[00:01.00]Hello\n[00:03.00]World"], "song.lrc");
      await expect(importLyricsFile(lrc, fileImportContext())).resolves.toBe(true);
      expect(lineTexts()).toEqual(["Hello", "World"]);
    });
  });

  describe("error paths", () => {
    it("reports a .json file that is not a readable project", async () => {
      allowConsole(/could not read the project file/);
      const screen = await renderHosts();
      await expect(importLyricsFile(new File(["{ broken"], "song.json"), fileImportContext())).resolves.toBe(false);
      await expect.element(screen.getByText("Couldn't read that project file")).toBeInTheDocument();
      expect(lineTexts()).toEqual([]);
    });

    it("refuses a file that is neither lyrics nor a project, naming both", async () => {
      const screen = await renderHosts();
      await expect(importLyricsFile(new File(["x"], "cover.png"), fileImportContext())).resolves.toBe(false);
      await expect.element(screen.getByText(UNSUPPORTED_LYRICS_IMPORT_MESSAGE)).toBeInTheDocument();
    });
  });
});
