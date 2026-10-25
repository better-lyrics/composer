import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ToggleButton } from "@/ui/toggle-button";
import { cn } from "@/utils/cn";
import { loopsRange, toggleLoop } from "@/views/timeline/selection-playback";
import { STRIP_CONTROL, STRIP_TRAY } from "@/views/timeline/strip-control";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconRepeat } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const LoopToggleButton: React.FC<{ pressed: boolean; onClick: () => void }> = ({ pressed, onClick }) => (
  <div className={STRIP_TRAY}>
    <ToggleButton pressed={pressed} size="sm" hasIcon className={cn(STRIP_CONTROL, "pr-1.5")} onClick={onClick}>
      <IconRepeat aria-hidden="true" className="size-3.5" />
      Loop
      <InlineKeyBadge keys={getEffectiveKeysArray("global.toggleLoop")} />
    </ToggleButton>
  </div>
);

const LoopToggle: React.FC = () => {
  const selectionPlayback = useTimelineStore((s) => s.selectionPlayback);
  const loopRegion = useTimelineStore((s) => s.loopRegion);
  const loopOpenGroup = useSettingsStore((s) => s.loopOpenGroup);
  return <LoopToggleButton pressed={loopsRange(selectionPlayback, loopOpenGroup, loopRegion)} onClick={toggleLoop} />;
};

// -- Exports -------------------------------------------------------------------

export { LoopToggle, LoopToggleButton };
