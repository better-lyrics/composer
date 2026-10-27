import { useAudioStore } from "@/stores/audio";
import { isAutoAlignAvailable } from "@/stores/alignment";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { AutoAlignPanel, AutoAlignStatus } from "@/views/sync/auto-align-panel";

// -- Component ----------------------------------------------------------------

// Word timing from the separated vocals, using each line's tapped timing as
// the guide. Laid out like the vocal separation popover: the trigger shows
// progress, the popover walks through what's still needed.
const AutoAlignDropdown: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  if (!isAutoAlignAvailable() || !source) return null;

  return (
    <Popover
      placement="bottom-end"
      aria-label="Auto-align words"
      trigger={
        <Button
          variant="ghost"
          size="lg"
          hasIcon
          className="shrink-0 aria-expanded:bg-(--layer-1)"
          aria-label="Auto-align words"
        >
          <AutoAlignStatus idleLabel="Auto-align" />
        </Button>
      }
    >
      {() => <AutoAlignPanel />}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { AutoAlignDropdown };
