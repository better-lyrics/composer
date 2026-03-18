import type { ClipboardData, PasteMode } from "@/views/timeline/selection-types";
import { create } from "zustand";

// -- Types ---------------------------------------------------------------------

interface WordSelection {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  type: "word" | "bg";
}

interface TimelineState {
  zoom: number;
  followEnabled: boolean;
  previewSidebarOpen: boolean;
  selectedWords: WordSelection[];
  clipboard: ClipboardData | null;
  pasteMode: PasteMode;
  scrollLeft: number;
  rowHeights: Record<string, number>;
  defaultRowHeight: number;
  isDraggingPlayhead: boolean;
  dragTime: number;
}

interface TimelineActions {
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleFollow: () => void;
  togglePreviewSidebar: () => void;
  setSelectedWords: (selections: WordSelection[]) => void;
  toggleSelection: (selection: WordSelection) => void;
  clearSelection: () => void;
  setClipboard: (clipboard: ClipboardData | null) => void;
  setPasteMode: (mode: PasteMode) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setRowHeight: (lineId: string, height: number) => void;
  setDraggingPlayhead: (isDragging: boolean, time?: number) => void;
  setDragTime: (time: number) => void;
}

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;
const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const ZOOM_STEP = 20;
const DEFAULT_ZOOM = 100;
const MIN_ROW_HEIGHT = 32;
const MAX_ROW_HEIGHT = 120;
const DEFAULT_ROW_HEIGHT = 44;

// -- Store ---------------------------------------------------------------------

const useTimelineStore = create<TimelineState & TimelineActions>((set, get) => ({
  zoom: DEFAULT_ZOOM,
  followEnabled: true,
  previewSidebarOpen: false,
  selectedWords: [],
  clipboard: null,
  pasteMode: { status: "idle" },
  scrollLeft: 0,
  rowHeights: {},
  defaultRowHeight: DEFAULT_ROW_HEIGHT,
  isDraggingPlayhead: false,
  dragTime: 0,

  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(MAX_ZOOM, s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(MIN_ZOOM, s.zoom - ZOOM_STEP) })),
  toggleFollow: () => set((s) => ({ followEnabled: !s.followEnabled })),
  togglePreviewSidebar: () => set((s) => ({ previewSidebarOpen: !s.previewSidebarOpen })),
  setSelectedWords: (selectedWords) => set({ selectedWords }),
  toggleSelection: (selection) =>
    set((s) => {
      const exists = s.selectedWords.some(
        (w) => w.lineId === selection.lineId && w.wordIndex === selection.wordIndex && w.type === selection.type,
      );
      if (exists) {
        return {
          selectedWords: s.selectedWords.filter(
            (w) => !(w.lineId === selection.lineId && w.wordIndex === selection.wordIndex && w.type === selection.type),
          ),
        };
      }
      return { selectedWords: [...s.selectedWords, selection] };
    }),
  clearSelection: () => set({ selectedWords: [] }),
  setClipboard: (clipboard) => set({ clipboard }),
  setPasteMode: (pasteMode) => set({ pasteMode }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
  setRowHeight: (lineId, height) =>
    set((s) => ({
      rowHeights: {
        ...s.rowHeights,
        [lineId]: Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, height)),
      },
    })),
  setDraggingPlayhead: (isDraggingPlayhead, time) => set({ isDraggingPlayhead, dragTime: time ?? get().dragTime }),
  setDragTime: (dragTime) => set({ dragTime }),
}));

function isWordSelected(selectedWords: WordSelection[], lineId: string, wordIndex: number, type: "word" | "bg") {
  return selectedWords.some((w) => w.lineId === lineId && w.wordIndex === wordIndex && w.type === type);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineStore, isWordSelected, GUTTER_WIDTH, MIN_ZOOM, MAX_ZOOM, DEFAULT_ROW_HEIGHT };
export type { WordSelection };
