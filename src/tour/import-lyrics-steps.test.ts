import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { importLyricsButtonStep, importLyricsDialogStep, leaveImportLyricsDialog } from "@/tour/import-lyrics-steps";
import { type DriveStep, driver } from "driver.js";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function resolveElement(step: DriveStep): Element | null {
  return typeof step.element === "function" ? step.element() : null;
}

function hookOptions(step: DriveStep, onMoveNext: () => void) {
  const tourDriver = { ...driver({ steps: [step] }), moveNext: onMoveNext };
  return { config: { steps: [step] }, state: {}, driver: tourDriver, index: 0 };
}

// -- Tests --------------------------------------------------------------------

describe("importLyricsButtonStep", () => {
  it("anchors to the Import Lyrics button", () => {
    const button = document.createElement("button");
    button.dataset.tour = "import-lyrics-button";
    document.body.append(button);
    expect(resolveElement(importLyricsButtonStep())).toBe(button);
    button.remove();
  });

  it("explains search, paste, upload and double-click", () => {
    const description = importLyricsButtonStep().popover?.description ?? "";
    for (const phrase of ["finds your song's lyrics", "pasted lyrics", "uploads a file", "Double-click"]) {
      expect(description).toContain(phrase);
    }
  });

  it("switches to the Edit tab", () => {
    useProjectStore.setState({ activeTab: "sync" });
    const step = importLyricsButtonStep();
    step.onHighlightStarted?.(
      undefined,
      step,
      hookOptions(step, () => {}),
    );
    expect(useProjectStore.getState().activeTab).toBe("edit");
  });
});

describe("importLyricsDialogStep", () => {
  it("opens the Import Lyrics modal while it waits for the dialog to render", () => {
    const step = importLyricsDialogStep();
    expect(step.waitForElement).toBeGreaterThan(0);
    expect(resolveElement(step)).toBeNull();
    expect(useImportModalStore.getState().isOpen).toBe(true);
  });

  it("anchors to the rendered dialog", () => {
    const dialog = document.createElement("dialog");
    const body = document.createElement("div");
    body.dataset.tour = "lyrics-import-modal";
    dialog.append(body);
    document.body.append(dialog);
    expect(resolveElement(importLyricsDialogStep())).toBe(dialog);
    dialog.remove();
  });

  it("names every upload format and project files", () => {
    const description = importLyricsDialogStep().popover?.description ?? "";
    for (const label of [".txt", ".lrc", ".srt", ".ttml", ".qrc", "project file"]) expect(description).toContain(label);
  });

  it("moves on when the user closes the modal during the step", () => {
    const step = importLyricsDialogStep();
    let moves = 0;
    useImportModalStore.getState().open();
    step.onHighlightStarted?.(
      undefined,
      step,
      hookOptions(step, () => moves++),
    );
    useImportModalStore.getState().close();
    expect(moves).toBe(1);
  });

  it("closes the modal when the step is left, without moving on again", () => {
    const step = importLyricsDialogStep();
    let moves = 0;
    useImportModalStore.getState().open();
    const options = hookOptions(step, () => moves++);
    step.onHighlightStarted?.(undefined, step, options);
    step.onDeselected?.(undefined, step, options);
    expect(useImportModalStore.getState().isOpen).toBe(false);
    expect(moves).toBe(0);
  });

  describe("regressions", () => {
    it("regression: leaving the tour before the step settles closes the modal it opened and stops watching", () => {
      const step = importLyricsDialogStep();
      let moves = 0;
      resolveElement(step);
      step.onHighlightStarted?.(
        undefined,
        step,
        hookOptions(step, () => moves++),
      );
      leaveImportLyricsDialog();
      expect(useImportModalStore.getState().isOpen).toBe(false);
      useImportModalStore.getState().open();
      useImportModalStore.getState().close();
      expect(moves).toBe(0);
    });

    it("regression: leaving the tour never closes a modal the user opened", () => {
      useImportModalStore.getState().open({ section: "upload" });
      leaveImportLyricsDialog();
      expect(useImportModalStore.getState().isOpen).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("does not reopen a modal that is already open", () => {
      useImportModalStore.getState().open({ section: "paste" });
      resolveElement(importLyricsDialogStep());
      expect(useImportModalStore.getState().initialSection).toBe("paste");
    });

    it("watches the modal once when the step is highlighted twice", () => {
      const step = importLyricsDialogStep();
      let moves = 0;
      useImportModalStore.getState().open();
      const options = hookOptions(step, () => moves++);
      step.onHighlightStarted?.(undefined, step, options);
      step.onHighlightStarted?.(undefined, step, options);
      useImportModalStore.getState().close();
      expect(moves).toBe(1);
    });
  });
});
