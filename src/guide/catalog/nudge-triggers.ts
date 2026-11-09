import type { GuideNudgeEntry } from "@/domain/guide/model";
import { isAutoAlignAvailable } from "@/stores/alignment";

// -- Types --------------------------------------------------------------------

interface GuideNudgeTrigger extends GuideNudgeEntry {
  when?: () => boolean;
}

// -- Triggers -----------------------------------------------------------------

// Data only, so signal checks never load tip copy. Copy and actions live in nudges.tsx under the same ids.
const GUIDE_NUDGE_TRIGGERS: readonly GuideNudgeTrigger[] = [
  {
    id: "syllableGap",
    stage: "timeline",
    category: "timeline-gaps",
    trigger: { signal: "timeline.syllablesMovedTogether", count: 3, windowMs: 120_000 },
    resolvedBy: "timeline.gap",
  },
  {
    id: "loopHardPart",
    stage: "timeline",
    category: "timeline-loop",
    trigger: { signal: "timeline.replaySameSpot", count: 3, windowMs: 120_000 },
    resolvedBy: "timeline.loop",
  },
  {
    id: "zoomFaster",
    stage: "timeline",
    category: "timeline-zoom",
    trigger: { signal: "timeline.zoomButton", count: 5, windowMs: 10_000 },
    resolvedBy: "timeline.zoom",
  },
  {
    id: "nudgeWithKeys",
    stage: "timeline",
    category: "timeline-keys",
    trigger: { signal: "timeline.tinyDrag", count: 3, windowMs: 60_000 },
    resolvedBy: "timeline.nudge",
  },
  {
    id: "resyncLine",
    stage: "sync",
    category: "sync-resync",
    trigger: { signal: "sync.undoTap", count: 3, windowMs: 90_000 },
    resolvedBy: "sync.resync",
  },
  {
    id: "slowDown",
    stage: "sync",
    category: "sync-speed",
    trigger: { signal: "sync.earlyTap", count: 3, windowMs: 60_000 },
    resolvedBy: "sync.speed",
  },
  {
    id: "tryAutoAlign",
    stage: "sync",
    category: "sync-auto-align",
    trigger: { signal: "sync.tap", count: 40, windowMs: 5 * 60_000 },
    resolvedBy: "sync.autoAlign",
    when: isAutoAlignAvailable,
  },
  {
    id: "keysWhileTyping",
    stage: "edit",
    category: "edit-keys",
    trigger: { signal: "edit.playButton", count: 3, windowMs: 120_000 },
    resolvedBy: "edit.playWhileTyping",
  },
  {
    id: "backgroundVocal",
    stage: "edit",
    category: "edit-background",
    trigger: { signal: "edit.parenInLine", count: 1, windowMs: 60_000 },
    resolvedBy: "edit.background",
  },
  {
    id: "romanize",
    stage: "edit",
    category: "edit-romanize",
    trigger: { signal: "edit.nonLatinLyrics", count: 1, windowMs: 60_000 },
    resolvedBy: "languages.romanize",
  },
];

// -- Exports ------------------------------------------------------------------

export { GUIDE_NUDGE_TRIGGERS };
