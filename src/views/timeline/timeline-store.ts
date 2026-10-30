import type { LanguageTextVariant } from "@/domain/language/display";
import { hasTransliteration } from "@/domain/language/has-transliteration";
import type { ResumePosition } from "@/domain/project/resume-position";
import type { LoopRegion } from "@/domain/selection/loop-region";
import type { WordSelection } from "@/domain/selection/model";
import { toggleWordSelection } from "@/domain/selection/set-ops";
import type { Bounds } from "@/domain/word/bounds";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import type { GroupFocus } from "@/views/timeline/group-focus";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import type { ClipboardData, PasteMode } from "@/views/timeline/selection-types";
import { create } from "zustand";

// -- Types ---------------------------------------------------------------------

type ContextMenuTarget =
  | { kind: "word"; lineId: string; lineIndex: number; wordIndex: number; type: "word" | "bg" }
  | { kind: "track"; lineId: string; lineIndex: number; time: number; type: "word" | "bg" }
  | { kind: "gutter"; lineId: string; lineIndex: number }
  | { kind: "group-banner"; groupId: string; instanceIdx: number; source: "gutter" | "banner" };

interface ContextMenuState {
  x: number;
  y: number;
  target: ContextMenuTarget;
}

interface TrackHit {
  lineIndex: number;
  track: "word" | "bg";
}

interface EditingWord {
  lineId: string;
  wordIndex: number;
  type: "word" | "bg";
}

type SelectionPlaybackMode = "once" | "loop";

interface LoopRegionDrag {
  edge: "begin" | "end";
  snappedTo: { kind: "pin" | "onset" | "beat"; label: string } | null;
  draft: Bounds | null;
}

interface TimelineState {
  zoom: number;
  textVariant: LanguageTextVariant;
  selectedWords: WordSelection[];
  selectionPlayback: SelectionPlaybackMode | null;
  loopRegion: LoopRegion | null;
  loopRegionDrag: LoopRegionDrag | null;
  waveformReady: boolean;

  clipboard: ClipboardData | null;
  pasteMode: PasteMode;
  scrollLeft: number;
  scrollTop: number | null;
  pendingResumeView: ResumePosition | null;
  rowHeights: Record<string, number>;
  defaultRowHeight: number;
  isDraggingPlayhead: boolean;
  dragTime: number;
  contextMenu: ContextMenuState | null;
  editingWord: EditingWord | null;
  markerMode: boolean;
  hoveredSnapPointId: string | null;
  collapsedInstances: Record<string, boolean>;
  focusedGroup: GroupFocus | null;
  pingingGroupId: string | null;
  renamingGroupId: string | null;
  renamingInstanceIdx: number | null;
  draggedGroupShift: { groupId: string; instanceIdx: number; offsetPx: number } | null;
  wordDragHover: TrackHit | null;
  isBypassing: boolean;
  snappedBlockId: string | null;
  snappedAnchorTime: number | null;
  vocalOnsetSnapPoints: number[];
  vocalOnsetDetectionStatus: "idle" | "processing" | "error";
  vocalOnsetDetectionError: string | null;
  pitchTrackGeneration: number;
  loupeTarget: LoupeTarget | null;
}

interface TimelineActions {
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleTextVariant: () => void;
  setTextVariant: (textVariant: LanguageTextVariant) => void;
  setSelectedWords: (selections: WordSelection[]) => void;
  setSelectionPlayback: (mode: SelectionPlaybackMode | null) => void;
  setLoopRegion: (region: LoopRegion | null) => void;
  setLoopRegionDrag: (drag: LoopRegionDrag | null) => void;
  setWaveformReady: (ready: boolean) => void;

  toggleSelection: (selection: WordSelection) => void;
  clearSelection: () => void;
  setClipboard: (clipboard: ClipboardData | null) => void;
  setPasteMode: (mode: PasteMode) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setScrollTop: (scrollTop: number) => void;
  setPendingResumeView: (view: ResumePosition | null) => void;
  setRowHeight: (lineId: string, height: number) => void;
  setDraggingPlayhead: (isDragging: boolean, time?: number) => void;
  setDragTime: (time: number) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  clearContextMenu: () => void;
  setEditingWord: (editing: EditingWord | null) => void;
  clearEditingWord: () => void;
  resetProjectScope: () => void;
  toggleMarkerMode: () => void;
  setHoveredSnapPointId: (id: string | null) => void;
  setInstanceCollapsed: (key: string, isCollapsed: boolean) => void;
  toggleInstanceCollapsed: (key: string) => void;
  openGroup: (groupId: string, instanceIdx: number) => void;
  closeGroup: () => void;
  setPingingGroupId: (groupId: string | null) => void;
  setRenamingGroupId: (groupId: string | null, instanceIdx?: number | null) => void;
  setDraggedGroupShift: (shift: { groupId: string; instanceIdx: number; offsetPx: number } | null) => void;
  setWordDragHover: (hover: TrackHit | null) => void;
  setIsBypassing: (v: boolean) => void;
  setSnappedBlockId: (id: string | null) => void;
  setSnappedAnchorTime: (t: number | null) => void;
  setVocalOnsetSnapPoints: (points: number[]) => void;
  setVocalOnsetDetectionStatus: (status: "idle" | "processing" | "error", error?: string | null) => void;
  setPitchTrackGeneration: (generation: number) => void;
  setLoupeTarget: (target: LoupeTarget | null) => void;
}

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;
const WAVEFORM_HEIGHT = 80;
const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const ZOOM_STEP = 20;
const MIN_ROW_HEIGHT = 32;
const MAX_ROW_HEIGHT = 120;

// -- Store ---------------------------------------------------------------------

const useTimelineStore = create<TimelineState & TimelineActions>((set, get) => {
  const settings = useSettingsStore.getState();
  return {
    zoom: settings.defaultZoom,
    textVariant: "original",
    selectedWords: [],
    selectionPlayback: null,
    loopRegion: null,
    loopRegionDrag: null,
    waveformReady: false,

    clipboard: null,
    pasteMode: { status: "idle" },
    scrollLeft: 0,
    scrollTop: null,
    pendingResumeView: null,
    rowHeights: {},
    defaultRowHeight: settings.defaultRowHeight,
    isDraggingPlayhead: false,
    dragTime: 0,
    contextMenu: null,
    editingWord: null,
    markerMode: false,
    hoveredSnapPointId: null,
    collapsedInstances: {},
    focusedGroup: null,
    pingingGroupId: null,
    renamingGroupId: null,
    renamingInstanceIdx: null,
    draggedGroupShift: null,
    wordDragHover: null,
    isBypassing: false,
    snappedBlockId: null,
    snappedAnchorTime: null,
    vocalOnsetSnapPoints: [],
    vocalOnsetDetectionStatus: "idle",
    vocalOnsetDetectionError: null,
    pitchTrackGeneration: 0,
    loupeTarget: null,

    setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
    zoomIn: () => set((s) => ({ zoom: Math.min(MAX_ZOOM, s.zoom + ZOOM_STEP) })),
    zoomOut: () => set((s) => ({ zoom: Math.max(MIN_ZOOM, s.zoom - ZOOM_STEP) })),
    // Every toggle path lands here, including shortcuts whose button is not mounted.
    toggleTextVariant: () =>
      set((s) => {
        if (s.textVariant === "transliteration") return { textVariant: "original" };
        return hasTransliteration(useProjectStore.getState().lines) ? { textVariant: "transliteration" } : s;
      }),
    setTextVariant: (textVariant) => set({ textVariant }),
    setSelectedWords: (selectedWords) =>
      set(selectedWords.length > 0 ? { selectedWords, loopRegion: null } : { selectedWords }),
    setSelectionPlayback: (selectionPlayback) => set({ selectionPlayback }),
    setLoopRegion: (loopRegion) =>
      set((s) => (loopRegion && s.selectedWords.length > 0 ? { loopRegion, selectedWords: [] } : { loopRegion })),
    setLoopRegionDrag: (loopRegionDrag) => set({ loopRegionDrag }),
    setWaveformReady: (waveformReady) => set({ waveformReady }),

    toggleSelection: (selection) =>
      set((s) => ({ selectedWords: toggleWordSelection(s.selectedWords, selection), loopRegion: null })),
    clearSelection: () => set({ selectedWords: [] }),
    setClipboard: (clipboard) => set({ clipboard }),
    setPasteMode: (pasteMode) => set({ pasteMode }),
    setScrollLeft: (scrollLeft) => {
      if (get().scrollLeft !== scrollLeft) set({ scrollLeft });
    },
    setScrollTop: (scrollTop) => {
      if (get().scrollTop !== scrollTop) set({ scrollTop });
    },
    setPendingResumeView: (pendingResumeView) => set({ pendingResumeView }),
    setRowHeight: (lineId, height) =>
      set((s) => ({
        rowHeights: {
          ...s.rowHeights,
          [lineId]: Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, height)),
        },
      })),
    setDraggingPlayhead: (isDraggingPlayhead, time) => set({ isDraggingPlayhead, dragTime: time ?? get().dragTime }),
    setDragTime: (dragTime) => set({ dragTime }),
    setContextMenu: (contextMenu) => set({ contextMenu }),
    clearContextMenu: () => set({ contextMenu: null }),
    setEditingWord: (editingWord) => set({ editingWord }),
    clearEditingWord: () => set({ editingWord: null }),
    resetProjectScope: () =>
      set({
        selectedWords: [],
        selectionPlayback: null,
        loopRegion: null,
        loopRegionDrag: null,
        contextMenu: null,
        editingWord: null,
        pasteMode: { status: "idle" },
        scrollLeft: 0,
        scrollTop: null,
        pendingResumeView: null,
        focusedGroup: null,
        textVariant: "original",
      }),
    toggleMarkerMode: () => set((s) => ({ markerMode: !s.markerMode })),
    setHoveredSnapPointId: (hoveredSnapPointId) => set({ hoveredSnapPointId }),
    setInstanceCollapsed: (key, isCollapsed) =>
      set((s) => ({ collapsedInstances: { ...s.collapsedInstances, [key]: isCollapsed } })),
    toggleInstanceCollapsed: (key) =>
      set((s) => ({ collapsedInstances: { ...s.collapsedInstances, [key]: !s.collapsedInstances[key] } })),
    openGroup: (groupId, instanceIdx) =>
      set({ focusedGroup: { groupId, hearInstanceIdx: instanceIdx }, selectedWords: [], contextMenu: null }),
    closeGroup: () => set({ focusedGroup: null }),
    setPingingGroupId: (pingingGroupId) => set({ pingingGroupId }),
    setRenamingGroupId: (renamingGroupId, renamingInstanceIdx = null) =>
      set({ renamingGroupId, renamingInstanceIdx: renamingGroupId === null ? null : renamingInstanceIdx }),
    setDraggedGroupShift: (draggedGroupShift) => set({ draggedGroupShift }),
    setWordDragHover: (wordDragHover) =>
      set((s) =>
        s.wordDragHover?.lineIndex === wordDragHover?.lineIndex && s.wordDragHover?.track === wordDragHover?.track
          ? s
          : { wordDragHover },
      ),
    setIsBypassing: (v) => set({ isBypassing: v }),
    setSnappedBlockId: (id) => set({ snappedBlockId: id }),
    setSnappedAnchorTime: (t) => set({ snappedAnchorTime: t }),
    setVocalOnsetSnapPoints: (points) =>
      set({
        vocalOnsetSnapPoints: [...points].filter((point) => Number.isFinite(point) && point >= 0).sort((a, b) => a - b),
      }),
    setVocalOnsetDetectionStatus: (vocalOnsetDetectionStatus, error = null) =>
      set({ vocalOnsetDetectionStatus, vocalOnsetDetectionError: error }),
    setPitchTrackGeneration: (pitchTrackGeneration) => set({ pitchTrackGeneration }),
    setLoupeTarget: (loupeTarget) => set({ loupeTarget }),
  };
});

// -- Functions -----------------------------------------------------------------

// A region being drawn shows before it replaces the current one on release.
function shownLoopRegion(state: TimelineState): Bounds | null {
  return state.loopRegionDrag?.draft ?? state.loopRegion;
}

// -- Exports -------------------------------------------------------------------

export { shownLoopRegion, useTimelineStore, GUTTER_WIDTH, WAVEFORM_HEIGHT, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP };
export type { ContextMenuTarget, LoopRegionDrag, SelectionPlaybackMode, TrackHit };
