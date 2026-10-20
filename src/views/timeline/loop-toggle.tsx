import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ToggleButton } from "@/ui/toggle-button";
import { cn } from "@/utils/cn";
import { toggleLoop } from "@/views/timeline/selection-playback";
import { STRIP_CONTROL } from "@/views/timeline/strip-control";
import { IconRepeat } from "@tabler/icons-react";

// -- Components ----------------------------------------------------------------

const LoopToggle: React.FC = () => {
  const loop = useSettingsStore((s) => s.loopRange);
  return (
    <ToggleButton pressed={loop} size="sm" hasIcon className={cn(STRIP_CONTROL, "pr-1.5")} onClick={toggleLoop}>
      <IconRepeat aria-hidden="true" className="size-3.5" />
      Loop
      <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleLoop")} />
    </ToggleButton>
  );
};

// -- Exports -------------------------------------------------------------------

export { LoopToggle };
