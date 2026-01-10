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
  togglePreviewSidebar: () => void;
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
const MAX_CANVAS_WIDTH = 15000; // Browser canvas size limit

// Calculate safe max zoom based on duration to avoid exceeding canvas limits
function getMaxZoomForDuration(duration: number): number {
  if (duration <= 0) return MAX_ZOOM;
  return Math.min(MAX_ZOOM, Math.floor(MAX_CANVAS_WIDTH / duration));
}
const MIN_ROW_HEIGHT = 32;
const MAX_ROW_HEIGHT = 120;
const DEFAULT_ROW_HEIGHT = 44;

// -- Store ---------------------------------------------------------------------

const useTimelineStore = create<TimelineState & TimelineActions>((set, get) => ({
  zoom: DEFAULT_ZOOM,
  followEnabled: true,
  previewSidebarOpen: false,
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
  togglePreviewSidebar: () => set((s) => ({ previewSidebarOpen: !s.previewSidebarOpen })),
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
  getMaxZoomForDuration,
};
export type { WordSelection };
