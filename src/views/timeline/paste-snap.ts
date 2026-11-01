import { type TimeRange, timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import { snapPointTimes } from "@/domain/snap-point/model";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { clipboardInLane, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import { liveSnapAnchors, snapThresholdPx } from "@/views/timeline/point-snap-anchors";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { collectSnapAnchors, findSnapShift, type SnapAnchor } from "@/views/timeline/snap";
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

let cachedAnchors: { key: readonly unknown[]; anchors: SnapAnchor[] } | null = null;

function pasteSnapAnchors(): SnapAnchor[] {
  const { lines, customSnapPoints, beatGrid } = useProjectStore.getState();
  const { isPlaying, duration } = useAudioStore.getState();
  const { zoom, vocalOnsetSnapPoints } = useTimelineStore.getState();
  const playhead = isPlaying ? null : livePlaybackTime();
  const key = [
    lines,
    customSnapPoints,
    beatGrid,
    playhead,
    duration,
    zoom,
    vocalOnsetSnapPoints,
    useSettingsStore.getState(),
  ];
  if (cachedAnchors?.key.every((part, i) => part === key[i])) return cachedAnchors.anchors;
  const anchors = liveSnapAnchors(collectSnapAnchors(lines, new Set(), playhead, [], snapPointTimes(customSnapPoints)));
  cachedAnchors = { key, anchors };
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
  let rangeOf: ((line: LyricLine) => TimeRange) | null = null;
  return (shift) => {
    rangeOf ??= timeRangeResolver(lines, useProjectStore.getState().groups, useAudioStore.getState().duration);
    return !pasteOverlaps(pasted, target.lineIndex, delta + shift, lines, rangeOf);
  };
}

function snappedPasteTime(clipboard: ClipboardData, pointerTime: number, target: PasteSnapTarget): PasteSnap {
  if (target.bypass || clipboard.entries.length === 0) return { time: pointerTime, anchorTime: null };
  const anchors = pasteSnapAnchors();
  const delta = pointerTime - clipboard.entries[0].word.begin;
  const result = findSnapShift({
    edges: clipboard.entries.flatMap(({ word }) => [word.begin + delta, word.end + delta]),
    anchors,
    zoom: useTimelineStore.getState().zoom,
    thresholdPx: snapThresholdPx,
    overlapCheck: wordPasteOverlapCheck(clipboard, target, delta, useProjectStore.getState().lines),
  });
  return { time: pointerTime + result.shift, anchorTime: result.anchor?.t ?? null };
}

// -- Exports -------------------------------------------------------------------

export { snappedPasteTime };
