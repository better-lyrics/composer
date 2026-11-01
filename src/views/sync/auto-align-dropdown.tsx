import { useAudioStore } from "@/stores/audio";
import { isAutoAlignAvailable } from "@/stores/alignment";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { AutoAlignPanel } from "@/views/sync/auto-align-panel";
import { AutoAlignStatus } from "@/views/sync/auto-align-status";
import { IconChevronDown } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface AutoAlignDropdownProps {
  disabled?: boolean;
}

// -- Component ----------------------------------------------------------------

// Word timing from the separated vocals, using each line's tapped timing as
// the guide. Laid out like the vocal separation popover: the trigger shows
// progress, the popover walks through what's still needed.
const AutoAlignDropdown: React.FC<AutoAlignDropdownProps> = ({ disabled = false }) => {
  const source = useAudioStore((s) => s.source);
  if (!isAutoAlignAvailable() || !source) return null;

  return (
    <Popover
      placement="bottom-end"
      aria-label="Auto-align words"
      trigger={
        <Button
          size="lg"
          hasIcon
          disabled={disabled}
          aria-label="Auto-align words"
          className="shrink-0 pr-[5px] aria-expanded:bg-(--layer-3) aria-expanded:text-composer-text"
        >
          <AutoAlignStatus idleLabel="Auto-align" />
          <IconChevronDown className="size-3.5 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90" />
        </Button>
      }
    >
      {() => <AutoAlignPanel />}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { AutoAlignDropdown };
