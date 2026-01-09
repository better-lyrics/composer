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
  rippleEnabled: boolean;
  selectedWord: WordSelection | null;
  scrollLeft: number;
  rowHeights: Record<string, number>;
  defaultRowHeight: number;
}

interface TimelineActions {
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setRippleEnabled: (enabled: boolean) => void;
  toggleRipple: () => void;
  setSelectedWord: (selection: WordSelection | null) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setRowHeight: (lineId: string, height: number) => void;
  getRowHeight: (lineId: string) => number;
}

// -- Constants -----------------------------------------------------------------

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
  rippleEnabled: false,
  selectedWord: null,
  scrollLeft: 0,
  rowHeights: {},
  defaultRowHeight: DEFAULT_ROW_HEIGHT,

  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(MAX_ZOOM, s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(MIN_ZOOM, s.zoom - ZOOM_STEP) })),
  setRippleEnabled: (rippleEnabled) => set({ rippleEnabled }),
  toggleRipple: () => set((s) => ({ rippleEnabled: !s.rippleEnabled })),
  setSelectedWord: (selectedWord) => set({ selectedWord }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
  setRowHeight: (lineId, height) =>
    set((s) => ({
      rowHeights: {
        ...s.rowHeights,
        [lineId]: Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, height)),
      },
    })),
  getRowHeight: (lineId) => get().rowHeights[lineId] ?? get().defaultRowHeight,
}));

// -- Exports -------------------------------------------------------------------

export {
  useTimelineStore,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  MIN_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
  DEFAULT_ROW_HEIGHT,
};
export type { WordSelection };
