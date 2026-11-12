import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { showUndoToast } from "@/utils/undo-toast";
import { importLyrics } from "@/views/lyrics-import-modal/import-lyrics";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function commitLines(text: string): void {
  useProjectStore.getState().setLinesWithHistory([createLine({ text })]);
}

function currentText(): string | undefined {
  return useProjectStore.getState().lines[0]?.text;
}

// -- Tests --------------------------------------------------------------------

describe("showUndoToast", () => {
  it("undoes its own step", async () => {
    commitLines("First words");
    commitLines("Named step");
    const screen = await render(<Toaster />);
    showUndoToast("Named step done");
    await screen.getByRole("button", { name: "Undo" }).click();
    expect(currentText()).toBe("First words");
  });

  it("regression: a newer history step dismisses the notice and its Undo never undoes that step", async () => {
    commitLines("First words");
    commitLines("Named step");
    const screen = await render(<Toaster />);
    showUndoToast("Named step done");
    const undoButton = screen.getByRole("button", { name: "Undo" });
    await expect.element(undoButton).toBeInTheDocument();
    commitLines("Newer step");
    await expect.element(undoButton).not.toBeInTheDocument();
    expect(currentText()).toBe("Newer step");
  });

  it("regression: Undo after a lyrics import brings back the song details and the kept TTML edit", async () => {
    commitLines("Our own words");
    const keptEdit = { source: "<tt/>", content: "<tt>edited</tt>" };
    useProjectStore.getState().setMetadata({ title: "Our Title" });
    useProjectStore.getState().setTtmlEditState(keptEdit);
    const screen = await render(<Toaster />);
    importLyrics(
      { filename: "song.lrc", content: "[ti:Imported Title]\n[00:01.00]Imported words" },
      {
        audioDuration: 0,
        applyBackgroundExtraction: false,
        backgroundExtractionMergeStandalone: false,
        backgroundExtractionPreserveBrackets: false,
        sourceLabel: "Test",
      },
    );
    expect(useProjectStore.getState().metadata.title).toBe("Imported Title");
    await screen.getByRole("button", { name: "Undo" }).click();
    const state = useProjectStore.getState();
    expect(currentText()).toBe("Our own words");
    expect(state.metadata.title).toBe("Our Title");
    expect(state.ttmlEditState).toEqual(keptEdit);
    expect(state.hasUnexportedImport).toBe(false);
  });
});
