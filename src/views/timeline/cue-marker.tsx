import { useFrameLoop } from "@/hooks/use-frame-loop";
import { notePlacement } from "@/lib/replay-cue";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { ShortcutTip } from "@/ui/shortcut-tip";
import { Tooltip } from "@/ui/tooltip";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useRef } from "react";

// -- Constants -----------------------------------------------------------------

const HIDE_UNDER_PLAYHEAD_PX = 6;

// -- Helpers -------------------------------------------------------------------

function seekToCue(cue: number): void {
  useAudioStore.getState().seekTo(cue);
  notePlacement(cue, "pointer");
}

// -- Components ----------------------------------------------------------------

const CueMarker: React.FC = () => {
  const cue = useTimelineStore((s) => s.cue);
  const zoom = useTimelineStore((s) => s.zoom);
  const latched = useSettingsStore((s) => s.returnToCue);
  const anchorRef = useRef<HTMLDivElement>(null);

  useFrameLoop(
    () => {
      const anchor = anchorRef.current;
      if (!anchor || cue === null) return;
      const { zoom: liveZoom, isDraggingPlayhead, dragTime } = useTimelineStore.getState();
      const playhead = isDraggingPlayhead ? dragTime : livePlaybackTime();
      anchor.toggleAttribute("data-under-playhead", Math.abs(cue - playhead) * liveZoom < HIDE_UNDER_PLAYHEAD_PX);
    },
    "cue-marker",
    cue !== null,
  );

  if (cue === null) return null;

  // The ruler seeks to the pointer, which would nudge the cue by up to half the hit area; the notch lands on the cue itself.
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || event.altKey || useTimelineStore.getState().markerMode) return;
    event.stopPropagation();
    seekToCue(cue);
  };

  return (
    <div
      ref={anchorRef}
      data-cue-marker
      className="absolute inset-y-0 -ml-2 flex w-4 transition-opacity duration-150 ease-out data-[under-playhead]:opacity-0 data-[under-playhead]:pointer-events-none"
      style={{ left: cue * zoom }}
    >
      <Tooltip
        content={
          <ShortcutTip
            label="Cue"
            shortcut="timeline.playFromCue"
            description={latched ? "Plays from here, stop returns here" : "Plays from here"}
          />
        }
      >
        <button
          type="button"
          aria-label="Cue"
          className="flex w-4 items-end justify-center pb-px cursor-pointer select-none"
          onPointerDown={handlePointerDown}
          onClick={(event) => {
            if (event.detail === 0) seekToCue(cue);
          }}
        >
          <span aria-hidden="true" data-latched={latched || undefined} className="cue-notch" />
        </button>
      </Tooltip>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { CueMarker };
