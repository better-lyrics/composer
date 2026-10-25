import { BEAT_MODEL } from "@/audio/beat/beat-model";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { PopActions, PopButton, PopHead, PopText } from "@/views/timeline/beat-grid/beat-grid-layout";
import { IconMetronome } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BeatGridEmptyProps {
  hasAudio: boolean;
  onBack?: () => void;
}

// -- Components ----------------------------------------------------------------

const BeatGridEmpty: React.FC<BeatGridEmptyProps> = ({ hasAudio, onBack }) => (
  <>
    <PopHead title="Beat grid" onBack={onBack} />
    <PopText className="mt-1.5">
      Draw beats and bars on the waveform and snap words to them.
      {hasAudio &&
        ` Detection runs on your device after a one-time ${formatWholeMegabytes(BEAT_MODEL.approxBytes)} download.`}
    </PopText>
    <PopActions className="mt-4">
      {hasAudio && (
        <PopButton variant="primary" icon={IconMetronome} onClick={() => void useBeatDetectionStore.getState().run()}>
          Detect beats
        </PopButton>
      )}
    </PopActions>
  </>
);

// -- Exports -------------------------------------------------------------------

export { BeatGridEmpty };
