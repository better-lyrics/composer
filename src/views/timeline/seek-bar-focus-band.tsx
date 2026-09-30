import { useProjectStore } from "@/stores/project";
import { useEffectiveFocusGroup } from "@/views/timeline/effective-focus";
import { useFocusRange } from "@/views/timeline/use-focus-range";

// -- Interfaces ----------------------------------------------------------------

interface SeekBarFocusBandProps {
  duration: number;
}

// -- Component -----------------------------------------------------------------

const SeekBarFocusBand: React.FC<SeekBarFocusBandProps> = ({ duration }) => {
  const range = useFocusRange();
  const group = useEffectiveFocusGroup();
  const onTimeline = useProjectStore((s) => s.activeTab === "timeline");
  if (!range || !group || !onTimeline || duration <= 0) return null;

  const left = (Math.min(range.begin, duration) / duration) * 100;
  const width = (Math.min(range.end, duration) / duration) * 100 - left;

  return (
    <div
      data-seek-bar-focus-band
      aria-hidden="true"
      className="pointer-events-none absolute -inset-y-0.75 rounded-[3px]"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        background: `color-mix(in srgb, ${group.color} 45%, transparent)`,
      }}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { SeekBarFocusBand };
