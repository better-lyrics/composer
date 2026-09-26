import { describe, expect, it, onTestFinished } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { useProjectStore } from "@/stores/project";
import { stubClipboard } from "@/test/clipboard";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { ExportPanel } from "@/views/export";

// -- Helpers -------------------------------------------------------------------

function withImportedLyrics() {
  useProjectStore.setState({
    lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
  });
  useProjectStore.getState().markSongDetailsImported();
}

function importProjectFile(file: File) {
  const input = document.querySelector<HTMLInputElement>("input[type='file'][aria-label='Import project file']");
  if (!input) throw new Error("project import input not found");
  Object.defineProperty(input, "files", { value: [file] as unknown as FileList, configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

// -- Tests ---------------------------------------------------------------------

describe("ExportPanel · imported song details", () => {
  it("downloading the TTML marks the imported details as exported", async () => {
    withImportedLyrics();
    const screen = await render(<ExportPanel />);

    await screen.getByRole("button", { name: "Download TTML" }).click();

    expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
  });

  it("copying the TTML marks the imported details as exported", async () => {
    const clipboard = stubClipboard();
    onTestFinished(() => clipboard.restore());
    withImportedLyrics();
    const screen = await render(<ExportPanel />);

    await screen.getByRole("button", { name: "Copy" }).click();

    await expect.poll(() => useProjectStore.getState().hasUnexportedImport).toBe(false);
  });

  it("importing a project file marks its song details as imported", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<ExportPanel />);
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata: { title: "Imported", artists: [], album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
      groups: [],
      granularity: "word" as const,
    };

    importProjectFile(new File([JSON.stringify(payload)], "p.ttml-project.json", { type: "application/json" }));

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Imported");
    expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
  });

  describe("edge cases", () => {
    it("editing the TTML without exporting keeps the imported details unexported", async () => {
      withImportedLyrics();
      const screen = await render(<ExportPanel />);

      await screen.getByRole("button", { name: /Edit$/ }).click();

      expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
    });
  });
});
