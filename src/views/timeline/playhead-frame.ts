import type { LyricLine } from "@/domain/line/model";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getBannerNodes } from "@/views/timeline/banner-progress-registry";
import { GUTTER_WIDTH, timeToX } from "@/views/timeline/coords";
import { currentFocusScrollRange } from "@/views/timeline/effective-focus";
import { createFollowInput, fillFollowInput } from "@/views/timeline/follow-input";
import { clampScrollLeft } from "@/views/timeline/group-focus";
import { createRowLayoutCache } from "@/views/timeline/row-layout-cache";
import { createTimelineLights, paintTimelineLights } from "@/views/timeline/timeline-lights";
import { buildPlayheadMask, playheadMaskRoot } from "@/views/timeline/timeline-playhead-mask";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createFollowMemory, followScrollTop, followStep, resetFollowMemory } from "@/views/timeline/vertical-follow";
import { pinCutWordLabels } from "@/views/timeline/word-label-pin";
import type { RefObject } from "react";

// -- Types ---------------------------------------------------------------------

interface PlayheadElements {
  playhead: RefObject<HTMLDivElement | null>;
  cap: RefObject<HTMLDivElement | null>;
  overlay: RefObject<HTMLDivElement | null>;
  scrollContainer: RefObject<HTMLDivElement | null>;
}

interface PlayheadFrame {
  followMemory: ReturnType<typeof createFollowMemory>;
  followInput: ReturnType<typeof createFollowInput>;
  rowLayoutFor: ReturnType<typeof createRowLayoutCache>;
  lights: ReturnType<typeof createTimelineLights>;
  pinnedLabels: Set<HTMLElement>;
  verticalTarget: number | null;
  lastMask: string;
  playheadCenterXLocal: number;
  containerLeft: number;
  ready: boolean;
  hideScrollbars: boolean;
  position: number;
  displayTime: number;
  currentTime: number;
  scrollLeft: number;
  contentHeight: number;
  blocks: HTMLElement[];
  lines: readonly LyricLine[];
  mask: string | null;
}

// -- Functions -----------------------------------------------------------------

function createPlayheadFrame(): PlayheadFrame {
  return {
    followMemory: createFollowMemory(),
    followInput: createFollowInput(),
    rowLayoutFor: createRowLayoutCache(),
    lights: createTimelineLights(),
    pinnedLabels: new Set(),
    verticalTarget: null,
    lastMask: "",
    playheadCenterXLocal: 0,
    containerLeft: 0,
    ready: false,
    hideScrollbars: false,
    position: 0,
    displayTime: 0,
    currentTime: 0,
    scrollLeft: 0,
    contentHeight: 0,
    blocks: [],
    lines: [],
    mask: null,
  };
}

function followPlayback(frame: PlayheadFrame, container: HTMLDivElement, currentTime: number, zoom: number): void {
  const viewportWidth = container.clientWidth;
  const centerOffset = viewportWidth / 2 - GUTTER_WIDTH;
  const targetScrollLeft = Math.max(0, currentTime * zoom - centerOffset);
  const focusRange = currentFocusScrollRange(container);
  container.scrollLeft = focusRange ? clampScrollLeft(targetScrollLeft, focusRange) : targetScrollLeft;

  fillFollowInput(frame.followInput, frame.rowLayoutFor, currentTime, container.clientHeight);
  const rows = followStep(frame.followMemory, frame.followInput);
  if (rows) frame.verticalTarget = followScrollTop(rows, frame.followInput, container.scrollHeight);

  if (frame.verticalTarget === null) return;
  const diff = frame.verticalTarget - container.scrollTop;
  if (Math.abs(diff) > 0.5) {
    container.scrollTop += diff * 0.15;
  } else {
    container.scrollTop = frame.verticalTarget;
    frame.verticalTarget = null;
  }
}

// Follow scrolling happens here: a scroll write leaves layout clean, and every later read in the frame sees it.
function readPlayheadFrame(frame: PlayheadFrame, elements: PlayheadElements): void {
  frame.ready = false;
  if (!elements.playhead.current) return;

  const isPlaying = useAudioStore.getState().isPlaying;
  const currentTime = livePlaybackTime();
  const { zoom, scrollLeft, isDraggingPlayhead, dragTime, loopRegionDrag } = useTimelineStore.getState();
  const { followPlayhead } = useSettingsStore.getState();
  const container = elements.scrollContainer.current;

  // Follow would scroll the lanes under a region drag and stretch the region.
  if (followPlayhead && isPlaying && container && !isDraggingPlayhead && !loopRegionDrag) {
    followPlayback(frame, container, currentTime, zoom);
  } else {
    resetFollowMemory(frame.followMemory);
    frame.verticalTarget = null;
  }

  frame.hideScrollbars = isPlaying && followPlayhead;
  frame.currentTime = currentTime;
  frame.displayTime = isDraggingPlayhead ? dragTime : currentTime;
  const actualScrollLeft = container?.scrollLeft ?? scrollLeft;
  frame.position = timeToX(frame.displayTime, zoom, actualScrollLeft) - 1;

  frame.blocks.length = 0;
  if (container) {
    frame.contentHeight = container.scrollHeight;
    frame.scrollLeft = container.scrollLeft;
    frame.lines = useProjectStore.getState().lines;
    for (const block of container.querySelectorAll<HTMLElement>("[data-word-block][data-begin]")) {
      frame.blocks.push(block);
    }
  }

  frame.mask = null;
  const overlayRect = elements.overlay.current?.getBoundingClientRect();
  if (overlayRect) {
    const playheadCenterXLocal = timeToX(frame.displayTime, zoom, actualScrollLeft);
    frame.playheadCenterXLocal = playheadCenterXLocal;
    frame.containerLeft = overlayRect.left;
    frame.mask = container
      ? buildPlayheadMask(playheadMaskRoot(container), playheadCenterXLocal + overlayRect.left, overlayRect.top)
      : "";
  }
  frame.ready = true;
}

function bannerFill(banner: HTMLElement, currentTime: number): string | null {
  const startStr = banner.dataset.instanceStart;
  const endStr = banner.dataset.instanceEnd;
  if (!startStr || !endStr) return null;
  const startNum = Number.parseFloat(startStr);
  const endNum = Number.parseFloat(endStr);
  const span = endNum - startNum;
  if (!Number.isFinite(span) || span <= 0) return "0%";
  const ratio = (currentTime - startNum) / span;
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${(clamped * 100).toFixed(2)}%`;
}

function writeBannerProgress(currentTime: number): void {
  for (const banner of getBannerNodes()) {
    const fill = bannerFill(banner, currentTime);
    if (fill === null || banner.style.getPropertyValue("--progress-fill") === fill) continue;
    banner.style.setProperty("--progress-fill", fill);
  }
}

function writePlayheadFrame(frame: PlayheadFrame, elements: PlayheadElements): void {
  const playhead = elements.playhead.current;
  const cap = elements.cap.current;
  const container = elements.scrollContainer.current;
  if (!frame.ready || !playhead) return;

  container?.parentElement?.classList.toggle("scrollbar-hidden", frame.hideScrollbars);
  playhead.style.transform = `translate3d(${frame.position}px, 0, 0)`;
  if (cap) cap.style.transform = `translate3d(${frame.position + 1 - GUTTER_WIDTH}px, 0, 0)`;

  if (container) {
    playhead.style.height = `${frame.contentHeight}px`;
    paintTimelineLights(frame.lights, container, frame.blocks, frame.lines, frame.displayTime);
    pinCutWordLabels(frame.blocks, frame.scrollLeft, frame.pinnedLabels);
  }

  if (frame.mask !== null && frame.mask !== frame.lastMask) {
    frame.lastMask = frame.mask;
    playhead.style.maskImage = frame.mask;
    playhead.style.webkitMaskImage = frame.mask;
  }

  writeBannerProgress(frame.currentTime);
}

// -- Exports -------------------------------------------------------------------

export { createPlayheadFrame, readPlayheadFrame, writePlayheadFrame };
export type { PlayheadElements, PlayheadFrame };
