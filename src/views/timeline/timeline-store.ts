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
  selectedWord: WordSelection | null;
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
  setSelectedWord: (selection: WordSelection | null) => void;
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
  selectedWord: null,
  scrollLeft: 0,
  rowHeights: {},
  defaultRowHeight: DEFAULT_ROW_HEIGHT,
  isDraggingPlayhead: false,
  dragTime: 0,

  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(MAX_ZOOM, s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(MIN_ZOOM, s.zoom - ZOOM_STEP) })),
  toggleFollow: () => set((s) => ({ followEnabled: !s.followEnabled })),
  setSelectedWord: (selectedWord) => set({ selectedWord }),
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

// -- Exports -------------------------------------------------------------------

export {
  useTimelineStore,
  GUTTER_WIDTH,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  MIN_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
  DEFAULT_ROW_HEIGHT,
};
export type { WordSelection };
