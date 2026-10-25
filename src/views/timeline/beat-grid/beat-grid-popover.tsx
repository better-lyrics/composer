import { playableFile, useAudioStore } from "@/stores/audio";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { BeatGridEmpty } from "@/views/timeline/beat-grid/beat-grid-empty";
import { PopBody } from "@/views/timeline/beat-grid/beat-grid-layout";
import { BeatGridFailed } from "@/views/timeline/beat-grid/beat-grid-failed";
import { BeatGridProgress } from "@/views/timeline/beat-grid/beat-grid-progress";
import { BeatGridReady } from "@/views/timeline/beat-grid/beat-grid-ready";
import { isDetectionRunning } from "@/views/timeline/beat-grid/detection-progress";
import { SetTempoView } from "@/views/timeline/beat-grid/set-tempo-view";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type BodyView = "state" | "set-tempo" | "back-from-set-tempo";

// -- Interfaces ----------------------------------------------------------------

interface BeatGridPopoverBodyProps {
  onBack?: () => void;
}

interface BeatGridStateProps extends BeatGridPopoverBodyProps {
  onSetByHand: () => void;
}

// -- Components ----------------------------------------------------------------

const BeatGridState: React.FC<BeatGridStateProps> = ({ onSetByHand, onBack }) => {
  const grid = useProjectStore((s) => s.beatGrid);
  const status = useBeatDetectionStore((s) => s.status);
  const hasAudio = useAudioStore((s) => playableFile(s.source) !== null);

  if (isDetectionRunning(status)) return <BeatGridProgress onBack={onBack} />;
  if (status === "error") return <BeatGridFailed onSetByHand={onSetByHand} onBack={onBack} />;
  if (grid) return <BeatGridReady grid={grid} onSetByHand={onSetByHand} onBack={onBack} />;
  return <BeatGridEmpty hasAudio={hasAudio} onSetByHand={onSetByHand} onBack={onBack} />;
};

const BeatGridPopoverBody: React.FC<BeatGridPopoverBodyProps> = ({ onBack }) => {
  const [view, setView] = useState<BodyView>("state");
  return view === "set-tempo" ? (
    <PopBody key="set-tempo">
      <SetTempoView onDone={() => setView("back-from-set-tempo")} />
    </PopBody>
  ) : (
    <PopBody key="state" focusOnEnter={view === "back-from-set-tempo" ? "set-by-hand" : "first-control"}>
      <BeatGridState onSetByHand={() => setView("set-tempo")} onBack={onBack} />
    </PopBody>
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridPopoverBody };
