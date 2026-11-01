import type { Stem } from "@/audio/separation/types";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { PitchLineSwitch } from "@/ui/pitch-line-switch";
import { Popover } from "@/ui/popover";
import { STEM_LABELS } from "@/ui/stem-labels";
import { StemModelBlock } from "@/ui/stem-sources/stem-model-block";
import { StemSourceRows } from "@/ui/stem-sources/stem-source-rows";
import { VocalOnsetSnapToggle } from "@/ui/vocal-onset-snap-toggle";
import { DETECTING_VOCAL_ONSETS } from "@/ui/vocal-onset-status-copy";
import { StemPickLabel, VocalOnsetStatusAnnouncer } from "@/ui/vocal-separation-trigger";
import { percent } from "@/utils/percent";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- Types --------------------------------------------------------------------

interface VocalSeparationDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionAnchor?: HTMLElement | null;
}

// -- Helpers ------------------------------------------------------------------

// -- Component ----------------------------------------------------------------

const VocalSeparationDropdown: React.FC<VocalSeparationDropdownProps> = ({ open, onOpenChange, positionAnchor }) => {
  const source = useAudioStore((s) => s.source);
  const status = useSeparationStore((s) => s.status);
  const progress = useSeparationStore((s) => s.progress);
  const currentStem = useSeparationStore((s) => s.currentStem);
  const refreshModelCacheStatus = useSeparationStore((s) => s.refreshModelCacheStatus);
  const selectStem = useSeparationStore((s) => s.selectStem);
  const detectingOnsets = useTimelineStore((s) => s.vocalOnsetDetectionStatus === "processing");
  const variant = useSettingsStore((s) => s.vocalModelVariant);

  useEffect(() => {
    void variant;
    refreshModelCacheStatus();
  }, [refreshModelCacheStatus, variant]);

  if (!source) return null;

  const pct = percent(progress.loaded, progress.total);
  const separating = status === "downloading" || status === "processing";
  const showDetecting = detectingOnsets && !separating;
  const triggerLabel = separating ? `${pct}%` : STEM_LABELS[currentStem];
  const triggerName = showDetecting
    ? `Vocal separation, ${triggerLabel}, ${DETECTING_VOCAL_ONSETS.toLowerCase()}`
    : `Vocal separation, ${triggerLabel}`;

  return (
    <>
      <VocalOnsetStatusAnnouncer detecting={showDetecting} />
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="top-end"
        offsetPx={14}
        positionAnchor={positionAnchor}
        aria-label="Vocal separation"
        trigger={<StemPickLabel name={triggerName} label={triggerLabel} busy={separating || showDetecting} />}
      >
        {(close) => {
          const selectAndClose = (stem: Stem) => {
            selectStem(stem);
            close();
          };
          return (
            <div className="w-80 p-3.5">
              <p className="text-[13.5px] font-bold text-composer-text">Playback source</p>
              <StemSourceRows onSelect={selectAndClose} />
              <StemModelBlock />
              <div className="h-px my-2.5 bg-(--divider)" />
              <VocalOnsetSnapToggle />
              <div className="mt-3.5">
                <PitchLineSwitch />
              </div>
            </div>
          );
        }}
      </Popover>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { VocalSeparationDropdown };
