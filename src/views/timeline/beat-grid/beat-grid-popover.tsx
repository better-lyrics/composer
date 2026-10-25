import { playableFile, useAudioStore } from "@/stores/audio";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useProjectStore } from "@/stores/project";
import { BeatGridEmpty } from "@/views/timeline/beat-grid/beat-grid-empty";
import { BeatGridFailed } from "@/views/timeline/beat-grid/beat-grid-failed";
import { BeatGridProgress } from "@/views/timeline/beat-grid/beat-grid-progress";
import { BeatGridReady } from "@/views/timeline/beat-grid/beat-grid-ready";
import { isDetectionRunning } from "@/views/timeline/beat-grid/detection-progress";

// -- Interfaces ----------------------------------------------------------------

interface BeatGridPopoverBodyProps {
  onBack?: () => void;
}

// -- Components ----------------------------------------------------------------

const BeatGridState: React.FC<BeatGridPopoverBodyProps> = ({ onBack }) => {
  const grid = useProjectStore((s) => s.beatGrid);
  const status = useBeatDetectionStore((s) => s.status);
  const hasAudio = useAudioStore((s) => playableFile(s.source) !== null);

  if (isDetectionRunning(status)) return <BeatGridProgress onBack={onBack} />;
  if (status === "error") return <BeatGridFailed onBack={onBack} />;
  if (grid) return <BeatGridReady grid={grid} onBack={onBack} />;
  return <BeatGridEmpty hasAudio={hasAudio} onBack={onBack} />;
};

const BeatGridPopoverBody: React.FC<BeatGridPopoverBodyProps> = ({ onBack }) => (
  <div className="w-85 p-1.5 text-[13px] leading-[1.3] text-(--label)">
    <BeatGridState onBack={onBack} />
  </div>
);

// -- Exports -------------------------------------------------------------------

export { BeatGridPopoverBody };
