import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { ProgressBar } from "@/ui/progress-bar";
import { formatMegabytesOf } from "@/utils/format-file-size";
import { PopActions, PopButton, PopHead, PopText } from "@/ui/pop-layout";
import { detectionPercent } from "@/views/timeline/beat-grid/detection-progress";

// -- Components ----------------------------------------------------------------

const BeatGridProgress: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const downloading = useBeatDetectionStore((s) => s.status === "downloading");
  const loaded = useBeatDetectionStore((s) => s.loaded);
  const total = useBeatDetectionStore((s) => s.total);
  const percent = useBeatDetectionStore(detectionPercent);
  const title = downloading ? "Downloading model…" : "Finding beats…";
  const meta = downloading ? formatMegabytesOf(loaded, total || BEAT_MODEL.approxBytes) : `${percent}%`;

  return (
    <>
      <PopHead title={title} meta={meta} onBack={onBack} />
      <ProgressBar percent={percent} label={title} className="h-1.5 mx-2.5 mt-2.5 bg-(--well) shadow-(--well-edge)" />
      <PopText className="mt-2.5">You can keep working while it runs.</PopText>
      <PopActions className="mt-4">
        <PopButton onClick={() => useBeatDetectionStore.getState().cancel()}>Cancel</PopButton>
      </PopActions>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridProgress };
