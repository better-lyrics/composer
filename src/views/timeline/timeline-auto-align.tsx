import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { useAutoAlign } from "@/hooks/use-auto-align";
import { isAutoAlignAvailable, useAlignmentStore } from "@/stores/alignment";
import { countAlignableLines } from "@/stores/alignment-plan";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { SplitLatch } from "@/ui/split-latch";
import { Tooltip } from "@/ui/tooltip";
import { AutoAlignPanel, AutoAlignStatus } from "@/views/sync/auto-align-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const AUTO_ALIGN_EVENT = "timeline:auto-align";
const SHORTCUT = "timeline.autoAlign";

// -- Helpers -------------------------------------------------------------------

// The lines of the selected words, or else the line under the playhead.
function targetLineIds(lines: readonly LyricLine[]): string[] {
  const selected = useTimelineStore.getState().selectedWords.filter((w) => w.type === "word");
  if (selected.length > 0) return [...new Set(selected.map((w) => w.lineId))];
  const time = livePlaybackTime();
  const line = lines.find((l) => {
    const bounds = mainBounds(l);
    return bounds !== null && bounds.begin <= time && time < bounds.end;
  });
  return line ? [line.id] : [];
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
    const lineIds = targetLineIds(lines);
    const { lineTimed, wordTimed } = countAlignableLines(lines, lineIds);
    if (lineTimed + wordTimed === 0) {
      toast("Select a synced line's words, or move the playhead onto one, to align it.");
      return;
    }
    void autoAlign(lineIds, { realign: wordTimed > 0 });
  }, [busy, autoAlign]);

  useEffect(() => {
    if (!available) return;
    window.addEventListener(AUTO_ALIGN_EVENT, alignTarget);
    return () => window.removeEventListener(AUTO_ALIGN_EVENT, alignTarget);
  }, [available, alignTarget]);

  if (!available) return null;

  return (
    <div className="tray">
      <SplitLatch
        menuLabel="Auto-align options"
        open={open}
        onOpenChange={setOpen}
        latch={
          <Tooltip
            content={
              <ShortcutTip
                label="Align line"
                shortcut={SHORTCUT}
                description="Times the words of the selected line, or the line at the playhead"
              />
            }
            placement="bottom"
          >
            <Button
              variant="ghost"
              size="sm"
              hasIcon
              onClick={alignTarget}
              className="h-7 gap-1.5 pl-2 pr-1.5 text-[13px] [&>svg]:size-4 [&>[data-inline-key-badge]]:ml-0"
            >
              <AutoAlignStatus idleLabel="Align line" />
              {showHints && <InlineKeyBadge keys={getEffectiveKeysArray(SHORTCUT)} />}
            </Button>
          </Tooltip>
        }
      >
        <AutoAlignPanel />
      </SplitLatch>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { AUTO_ALIGN_EVENT, TimelineAutoAlign };
