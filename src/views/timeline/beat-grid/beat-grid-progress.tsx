import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { ModelProgress } from "@/ui/model-progress";
import { formatMegabytesOf } from "@/utils/format-file-size";
import { detectionPercent } from "@/views/timeline/beat-grid/detection-progress";

// -- Components ----------------------------------------------------------------

const BeatGridProgress: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const downloading = useBeatDetectionStore((s) => s.status === "downloading");
  const loaded = useBeatDetectionStore((s) => s.loaded);
  const total = useBeatDetectionStore((s) => s.total);
  const percent = useBeatDetectionStore(detectionPercent);

  return (
    <ModelProgress
      title={downloading ? "Downloading model…" : "Finding beats…"}
      meta={downloading ? formatMegabytesOf(loaded, total || BEAT_MODEL.approxBytes) : `${percent}%`}
      pct={percent}
      note="You can keep working while it runs."
      onCancel={() => useBeatDetectionStore.getState().cancel()}
      onBack={onBack}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { BeatGridProgress };
