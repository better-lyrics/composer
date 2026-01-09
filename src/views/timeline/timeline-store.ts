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
}

interface TimelineActions {
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setRippleEnabled: (enabled: boolean) => void;
  toggleRipple: () => void;
  setSelectedWord: (selection: WordSelection | null) => void;
  setScrollLeft: (scrollLeft: number) => void;
}

// -- Constants -----------------------------------------------------------------

const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const ZOOM_STEP = 20;
const DEFAULT_ZOOM = 100;

// -- Store ---------------------------------------------------------------------

const useTimelineStore = create<TimelineState & TimelineActions>((set) => ({
  zoom: DEFAULT_ZOOM,
  rippleEnabled: false,
  selectedWord: null,
  scrollLeft: 0,

  setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(MAX_ZOOM, s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(MIN_ZOOM, s.zoom - ZOOM_STEP) })),
  setRippleEnabled: (rippleEnabled) => set({ rippleEnabled }),
  toggleRipple: () => set((s) => ({ rippleEnabled: !s.rippleEnabled })),
  setSelectedWord: (selectedWord) => set({ selectedWord }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
}));

// -- Exports -------------------------------------------------------------------

export { useTimelineStore, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM };
export type { WordSelection };
