import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import { type SnapPoint, snapPointTimes } from "@/domain/snap-point/model";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { clipboardInLane, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import { liveSnapAnchors, snapThresholdPx } from "@/views/timeline/point-snap-anchors";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { type SnapAnchor, collectSnapAnchors, findSnapShift, playheadAnchor } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ----------------------------------------------------------------

interface PasteSnapTarget {
  lineIndex: number;
  lane: WordTrack | null;
  bypass: boolean;
}

interface PasteSnap {
  time: number;
  anchorTime: number | null;
}

// -- Functions -----------------------------------------------------------------

let cachedEdgeAnchors: { lines: LyricLine[]; markers: SnapPoint[]; anchors: SnapAnchor[] } | null = null;

function lyricAndMarkerAnchors(lines: LyricLine[], markers: SnapPoint[]): SnapAnchor[] {
  if (cachedEdgeAnchors?.lines === lines && cachedEdgeAnchors.markers === markers) return cachedEdgeAnchors.anchors;
  const anchors = collectSnapAnchors(lines, new Set(), null, [], snapPointTimes(markers));
  cachedEdgeAnchors = { lines, markers, anchors };
  return anchors;
}

function wordPasteOverlapCheck(
  clipboard: ClipboardData,
  target: PasteSnapTarget,
  delta: number,
  lines: LyricLine[],
): ((shift: number) => boolean) | undefined {
  if (clipboard.sourceInstance || target.lineIndex < 0) return undefined;
  const pasted = target.lane ? clipboardInLane(clipboard, target.lane) : clipboard;
  const rangeOf = timeRangeResolver(lines, useProjectStore.getState().groups, useAudioStore.getState().duration);
  return (shift) => !pasteOverlaps(pasted, target.lineIndex, delta + shift, lines, rangeOf);
}

function snappedPasteTime(clipboard: ClipboardData, pointerTime: number, target: PasteSnapTarget): PasteSnap {
  if (target.bypass || clipboard.entries.length === 0) return { time: pointerTime, anchorTime: null };
  const { lines, customSnapPoints } = useProjectStore.getState();
  const anchors = liveSnapAnchors(
    lyricAndMarkerAnchors(lines, customSnapPoints).concat(playheadAnchor(livePlaybackTime())),
  );
  const delta = pointerTime - clipboard.entries[0].word.begin;
  const result = findSnapShift({
    edges: clipboard.entries.flatMap(({ word }) => [word.begin + delta, word.end + delta]),
    anchors,
    zoom: useTimelineStore.getState().zoom,
    thresholdPx: snapThresholdPx,
    overlapCheck: wordPasteOverlapCheck(clipboard, target, delta, lines),
  });
  return { time: pointerTime + result.shift, anchorTime: result.anchor?.t ?? null };
}

// -- Exports -------------------------------------------------------------------

export { snappedPasteTime };
