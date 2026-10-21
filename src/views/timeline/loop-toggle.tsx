import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ToggleButton } from "@/ui/toggle-button";
import { cn } from "@/utils/cn";
import { loopsRange, toggleRangeLoop } from "@/views/timeline/selection-playback";
import { STRIP_CONTROL } from "@/views/timeline/strip-control";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconRepeat } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const LoopToggle: React.FC = () => {
  const selectionPlayback = useTimelineStore((s) => s.selectionPlayback);
  const loopOpenGroup = useSettingsStore((s) => s.loopOpenGroup);
  const loop = loopsRange(selectionPlayback, loopOpenGroup);
  return (
    <ToggleButton pressed={loop} size="sm" hasIcon className={cn(STRIP_CONTROL, "pr-1.5")} onClick={toggleRangeLoop}>
      <IconRepeat aria-hidden="true" className="size-3.5" />
      Loop
      <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleLoop")} />
    </ToggleButton>
  );
};

// -- Exports -------------------------------------------------------------------

export { LoopToggle };
