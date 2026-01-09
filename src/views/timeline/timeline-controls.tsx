import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconLink, IconLinkOff } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface TimelineControlsProps {
  rippleEnabled: boolean;
  onToggleRipple: () => void;
}

// -- Components ----------------------------------------------------------------

const TimelineControls: React.FC<TimelineControlsProps> = ({
  rippleEnabled,
  onToggleRipple,
}) => {
  const granularity = useProjectStore((s) => s.granularity);
  const setGranularity = useProjectStore((s) => s.setGranularity);

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 rounded-lg bg-composer-bg-elevated p-0.5">
        <button
          type="button"
          onClick={() => setGranularity("line")}
          className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
            granularity === "line"
              ? "bg-composer-button text-composer-text"
              : "text-composer-text-muted hover:text-composer-text"
          }`}
        >
          Line
        </button>
        <button
          type="button"
          onClick={() => setGranularity("word")}
          className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
            granularity === "word"
              ? "bg-composer-button text-composer-text"
              : "text-composer-text-muted hover:text-composer-text"
          }`}
        >
          Word
        </button>
      </div>
      <Button
        hasIcon
        variant={rippleEnabled ? "primary" : "secondary"}
        onClick={onToggleRipple}
        title={rippleEnabled ? "Ripple snap enabled" : "Ripple snap disabled"}
      >
        {rippleEnabled ? <IconLink className="w-4 h-4" /> : <IconLinkOff className="w-4 h-4" />}
        Ripple
      </Button>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineControls };
