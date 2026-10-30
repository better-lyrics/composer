import { LYRICS_FORMATS_PROSE } from "@/domain/lyrics-file/supported-formats";
import { useImportModalStore } from "@/stores/import-modal-store";
import { TAB_PANEL_RENDER_WAIT_MS, elementOnTab, showTab } from "@/tour/tab-panel-step";
import { PROJECT_FILE_PROSE } from "@/views/lyrics-import-modal/accepted-files";
import type { DriveStep } from "driver.js";

// -- Constants ----------------------------------------------------------------

const IMPORT_LYRICS_BUTTON_SELECTOR = '[data-tour="import-lyrics-button"]';
const IMPORT_LYRICS_MODAL_SELECTOR = '[data-tour="lyrics-import-modal"]';
const MODAL_RENDER_WAIT_MS = 1500;

// -- State --------------------------------------------------------------------

let stopWatchingModal: (() => void) | null = null;
let modalOpenedByTour = false;

// -- Helpers ------------------------------------------------------------------

// driver.js resolves a step's element before any hook runs, so the dialog is opened here and waitForElement covers the render.
function revealImportLyricsDialog(): Element {
  const dialog = document.querySelector(IMPORT_LYRICS_MODAL_SELECTOR)?.closest("dialog") ?? null;
  if (!dialog && !useImportModalStore.getState().isOpen) {
    modalOpenedByTour = true;
    useImportModalStore.getState().open();
  }
  return dialog as Element;
}

function stopWatching() {
  stopWatchingModal?.();
  stopWatchingModal = null;
}

// driver.js skips onDeselected when the tour closes mid transition, so the tour also calls this on every teardown.
function leaveImportLyricsDialog() {
  stopWatching();
  if (!modalOpenedByTour) return;
  modalOpenedByTour = false;
  useImportModalStore.getState().close();
}

// -- Steps --------------------------------------------------------------------

function importLyricsButtonStep(): DriveStep {
  return {
    element: elementOnTab("edit", IMPORT_LYRICS_BUTTON_SELECTOR),
    waitForElement: TAB_PANEL_RENDER_WAIT_MS,
    popover: {
      title: "Import lyrics you already have",
      description:
        "Import Lyrics finds your song's lyrics, takes pasted lyrics in any format, or uploads a file. Double-click it to go straight to the file picker.",
      side: "bottom",
      align: "end",
    },
  };
}

function importLyricsDialogStep(): DriveStep {
  return {
    element: revealImportLyricsDialog,
    waitForElement: MODAL_RENDER_WAIT_MS,
    popover: {
      title: "Search, paste, or upload",
      description: `Search by song and pick a result. Paste takes typed lyrics or a whole lyrics file. Upload takes ${LYRICS_FORMATS_PROSE} or ${PROJECT_FILE_PROSE}. Import something now, or press Next to keep going.`,
      side: "left",
      align: "start",
    },
    onHighlightStarted: (_element, _step, { driver }) => {
      showTab("edit");
      stopWatching();
      stopWatchingModal = useImportModalStore.subscribe((state, previous) => {
        if (previous.isOpen && !state.isOpen) driver.moveNext();
      });
    },
    onDeselected: () => {
      stopWatching();
      modalOpenedByTour = false;
      useImportModalStore.getState().close();
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { importLyricsButtonStep, importLyricsDialogStep, leaveImportLyricsDialog };
