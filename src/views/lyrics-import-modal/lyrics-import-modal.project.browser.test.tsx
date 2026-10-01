import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { PROJECT_FILE_NAME, backupText, projectFileNamed, projectFileText } from "@/test/project-file-fixtures";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { restoreProvidersForTests, snapshotProvidersForTests } from "@/utils/lyrics-search/registry";
import type { LyricsSearchProvider } from "@/utils/lyrics-search/types";
import { LyricsImportModalHost } from "@/views/lyrics-import-modal/lyrics-import-modal-host";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Harness ------------------------------------------------------------------

let providerSnapshot: readonly LyricsSearchProvider[] = [];

beforeEach(() => {
  providerSnapshot = snapshotProvidersForTests();
  restoreProvidersForTests([]);
  useSettingsStore.setState({ autoExtractBackgroundVocals: false });
});

afterEach(() => {
  restoreProvidersForTests(providerSnapshot);
  useImportModalStore.getState().close();
});

function host(): React.ReactElement {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <LyricsImportModalHost />
      <ConfirmModalHost />
      <ChoiceModalHost />
      <Toaster />
    </QueryClientProvider>
  );
}

async function dropIntoUpload(screen: Awaited<ReturnType<typeof render>>, file: File) {
  useImportModalStore.getState().open({ section: "upload" });
  await expect.poll(() => document.querySelector("[data-upload-dropzone]")).not.toBeNull();
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  document
    .querySelector("[data-upload-dropzone]")
    ?.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  await expect.element(screen.getByText(/Ready to import/i)).toBeInTheDocument();
  await screen.getByRole("button", { name: /^Import$/ }).click();
}

async function pasteIntoModal(screen: Awaited<ReturnType<typeof render>>, text: string) {
  useImportModalStore.getState().open({ section: "paste" });
  const textarea = screen.getByLabelText("Lyrics text");
  await expect.element(textarea).toBeInTheDocument();
  (textarea.element() as HTMLTextAreaElement).focus();
  await userEvent.fill(textarea, text);
  await screen.getByRole("button", { name: /^Import$/ }).click();
}

// -- Tests --------------------------------------------------------------------

describe("LyricsImportModal with project files", () => {
  it("uploads a project file, takes its lyrics and closes", async () => {
    const screen = await render(host());
    await dropIntoUpload(screen, projectFileNamed());
    await expect
      .element(screen.getByRole("alertdialog", { name: `${PROJECT_FILE_NAME} is a Composer project` }))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Use its lyrics here" }).click();
    await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
    expect(useProjectStore.getState().lines).toHaveLength(2);
  });

  it("keeps the modal open when the choice is cancelled", async () => {
    const screen = await render(host());
    await dropIntoUpload(screen, projectFileNamed());
    await expect.element(screen.getByRole("alertdialog")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
    await expect.element(screen.getByText(/Ready to import/i)).toBeInTheDocument();
    expect(useImportModalStore.getState().isOpen).toBe(true);
    expect(useProjectStore.getState().lines).toEqual([]);
  });

  it("names the project file extension on the modal drop overlay", async () => {
    const screen = await render(host());
    useImportModalStore.getState().open({ section: "upload" });
    await expect.element(screen.getByText("Drop lyrics file to import")).toBeInTheDocument();
    expect(document.body.textContent).toContain(".qrc .json");
  });

  describe("paste", () => {
    it("asks about pasted project text and opens it as its own project", async () => {
      const screen = await render(host());
      await pasteIntoModal(screen, projectFileText());
      await expect
        .element(screen.getByRole("alertdialog", { name: "You pasted a Composer project" }))
        .toBeInTheDocument();
      await screen.getByRole("button", { name: "Open as its own project" }).click();
      await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
      expect(openProjectIdSnapshot()).not.toBeNull();
      expect(useProjectStore.getState().metadata.title).toBe("Lust for Life");
    });

    it("offers only a restore for pasted backup text", async () => {
      const screen = await render(host());
      await pasteIntoModal(screen, backupText(["One", "Two"]));
      await expect
        .element(screen.getByRole("alertdialog", { name: "You pasted a Composer backup" }))
        .toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use its lyrics here" }).query()).toBeNull();
      await screen.getByRole("button", { name: "Cancel" }).click();
      expect(useImportModalStore.getState().isOpen).toBe(true);
    });

    it("still imports pasted JSON that is not a project as plain lyrics", async () => {
      const screen = await render(host());
      await pasteIntoModal(screen, '{"note": "not a project"}');
      await expect.poll(() => useImportModalStore.getState().isOpen).toBe(false);
      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(['{"note": "not a project"}']);
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    });
  });
});
