import { bgBounds, mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { useAutoAlign } from "@/hooks/use-auto-align";
import { isAutoAlignAvailable, useAlignmentStore } from "@/stores/alignment";
import { type AlignTarget, alignTargetsOf, countAlignableLines } from "@/stores/alignment-plan";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { SplitLatch } from "@/ui/split-latch";
import { AutoAlignPanel } from "@/views/sync/auto-align-panel";
import { AutoAlignStatus } from "@/views/sync/auto-align-status";
import { HeaderAction } from "@/views/timeline/header-action";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const AUTO_ALIGN_EVENT = "timeline:auto-align";
const SHORTCUT = "timeline.autoAlign";

// -- Helpers -------------------------------------------------------------------

// The tracks of the selected words, or else the lyrics under the playhead, or
// the background vocals there when no lyrics are.
function alignTargets(lines: readonly LyricLine[]): AlignTarget[] {
  const selected = useTimelineStore.getState().selectedWords;
  if (selected.length > 0) return alignTargetsOf(selected);
  const time = livePlaybackTime();
  const under = (bounds: { begin: number; end: number } | null) =>
    bounds !== null && bounds.begin <= time && time < bounds.end;
  const main = lines.find((l) => under(mainBounds(l)));
  if (main) return [{ lineId: main.id, track: "word" }];
  const bg = lines.find((l) => under(bgBounds(l)));
  return bg ? [{ lineId: bg.id, track: "bg" }] : [];
}

// -- Component -----------------------------------------------------------------

// Aligns one line by default: the selected one, or the one at the playhead.
// The arrow opens the Sync tab's panel, for the whole song and the setup steps.
const TimelineAutoAlign: React.FC = () => {
  const [open, setOpen] = useState(false);
  const hasAudio = useAudioStore((s) => !!s.source);
  const busy = useAlignmentStore((s) => s.status === "running" || s.status === "downloading");
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  const { autoAlign } = useAutoAlign();
  const available = hasAudio && isAutoAlignAvailable();

  const alignTarget = useCallback(() => {
    // A run is already going; show its progress and Cancel.
    if (busy) return setOpen(true);
    const lines = useProjectStore.getState().lines;
    const targets = alignTargets(lines);
    const { lineTimed, wordTimed } = countAlignableLines(lines, targets);
    if (lineTimed + wordTimed === 0) {
      toast("Select a synced line's words, or move the playhead onto one, to align it.");
      return;
    }
    void autoAlign(targets, { realign: wordTimed > 0 });
  }, [busy, autoAlign]);

  useEffect(() => {
    if (!available) return;
    window.addEventListener(AUTO_ALIGN_EVENT, alignTarget);
    return () => window.removeEventListener(AUTO_ALIGN_EVENT, alignTarget);
  }, [available, alignTarget]);

  if (!available) return null;

  return (
    <SplitLatch
      variant="action"
      menuLabel="Align whole song"
      menuTip={<ShortcutTip label="Align whole song" description="Set up, run and cancel auto-align for every line" />}
      open={open}
      onOpenChange={setOpen}
      latch={
        <HeaderAction
          onClick={alignTarget}
          label="Align line"
          shortcut={SHORTCUT}
          showHint={showHints && !busy}
          description="Times the words of the selected line, or the line at the playhead"
        >
          <AutoAlignStatus />
        </HeaderAction>
      }
    >
      <AutoAlignPanel />
    </SplitLatch>
  );
};

// -- Exports -------------------------------------------------------------------

export { AUTO_ALIGN_EVENT, TimelineAutoAlign };
