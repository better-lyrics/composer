import { DesignSection } from "@/pages/design/design-section";
import { StateCell } from "@/pages/design/state-cell";
import { type StateChip, StateChips } from "@/pages/design/state-chips";
import { Button } from "@/ui/button";
import { LoopToggleButton } from "@/views/timeline/loop-toggle";
import { SelectionPlaybackStrip } from "@/views/timeline/selection-playback-bar";
import type { SelectionPlaybackMode } from "@/views/timeline/timeline-store";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type PlaybackState = SelectionPlaybackMode | "off";

// -- Components ----------------------------------------------------------------

const SelectionPlaybackDemo: React.FC = () => {
  const [mode, setMode] = useState<SelectionPlaybackMode | null>(null);

  const states: readonly StateChip<PlaybackState>[] = [
    { id: "off", label: "Off", enter: () => setMode(null) },
    { id: "once", label: "Playing once", enter: () => setMode("once") },
    { id: "loop", label: "Looping", enter: () => setMode("loop") },
  ];

  return (
    <DesignSection
      id="selection-playback"
      note="Playing a selection opens a strip above the timeline. It plays the words once or loops them until you stop. Loop flips between the two without starting over, and Stop closes the strip."
    >
      <StateChips label="Selection playback states" states={states} current={mode ?? "off"} />
      <StateCell label="Above the timeline">
        {mode ? (
          <div className="w-full max-w-2xl overflow-hidden rounded-lg shadow-(--well-edge)">
            <SelectionPlaybackStrip
              mode={mode}
              wordCount={4}
              begin={12.48}
              end={15.2}
              loop={
                <LoopToggleButton
                  pressed={mode === "loop"}
                  onClick={() => setMode(mode === "loop" ? "once" : "loop")}
                />
              }
              onStop={() => setMode(null)}
            />
          </div>
        ) : (
          <Button size="lg" variant="secondary" hasIcon onClick={() => setMode("once")}>
            <IconPlayerPlay aria-hidden="true" className="size-4" />
            Play selection
          </Button>
        )}
      </StateCell>
    </DesignSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { SelectionPlaybackDemo };
