import { getModelDescriptor } from "@/audio/separation/model-registry";
import type { Stem } from "@/audio/separation/types";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { Popover } from "@/ui/popover";
import { STEM_LABELS } from "@/ui/stem-labels";
import { DETECTING_VOCAL_ONSETS } from "@/ui/vocal-onset-status-copy";
import { VocalOnsetStatusAnnouncer, StemPickLabel } from "@/ui/vocal-separation-trigger";
import { ErrorState, IdleNoModelState, IdleReadyState, PopText, ProgressState } from "@/ui/vocal-separation-states";
import { formatMegabytes } from "@/utils/format-file-size";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- Types --------------------------------------------------------------------

interface VocalSeparationDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionAnchor?: HTMLElement | null;
}

// -- Component ----------------------------------------------------------------

const VocalSeparationDropdown: React.FC<VocalSeparationDropdownProps> = ({ open, onOpenChange, positionAnchor }) => {
  const source = useAudioStore((s) => s.source);
  const status = useSeparationStore((s) => s.status);
  const progress = useSeparationStore((s) => s.progress);
  const error = useSeparationStore((s) => s.error);
  const currentStem = useSeparationStore((s) => s.currentStem);
  const availableStems = useSeparationStore((s) => s.availableStems);
  const modelCached = useSeparationStore((s) => s.modelCached);
  const hostingConfigured = useSeparationStore((s) => s.hostingConfigured);
  const refreshModelCacheStatus = useSeparationStore((s) => s.refreshModelCacheStatus);
  const detectingOnsets = useTimelineStore((s) => s.vocalOnsetDetectionStatus === "processing");

  const variant = useSettingsStore((s) => s.vocalModelVariant);
  const descriptor = getModelDescriptor(variant);

  const downloadModel = useSeparationStore((s) => s.downloadModel);
  const separate = useSeparationStore((s) => s.separate);
  const selectStem = useSeparationStore((s) => s.selectStem);
  const cancel = useSeparationStore((s) => s.cancel);
  const retry = useSeparationStore((s) => s.retry);

  useEffect(() => {
    void variant;
    refreshModelCacheStatus();
  }, [refreshModelCacheStatus, variant]);

  if (!hostingConfigured) return null;
  if (!source) return null;

  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
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
            <div className="w-78 p-3.5">
              {status === "error" && error && (
                <ErrorState
                  message={error.message}
                  onRetry={retry}
                  onDismiss={() => useSeparationStore.getState().reset()}
                />
              )}

              {status === "downloading" && (
                <ProgressState
                  title="Downloading model…"
                  detail={`${formatMegabytes(progress.loaded)} / ${formatMegabytes(progress.total || (descriptor?.approxBytes ?? 0))}`}
                  pct={pct}
                  onCancel={cancel}
                />
              )}

              {status === "processing" && (
                <ProgressState
                  title="Separating vocals…"
                  detail={progress.total > 0 ? `Chunk ${progress.loaded} of ${progress.total}` : "Preparing…"}
                  pct={pct}
                  onCancel={cancel}
                />
              )}

              {status === "idle" && !modelCached && (
                <IdleNoModelState
                  approxMb={descriptor?.approxMb ?? 85}
                  onDownload={downloadModel}
                  onSeparate={separate}
                />
              )}

              {status === "idle" && modelCached && (
                <IdleReadyState
                  availableStems={availableStems}
                  currentStem={currentStem}
                  onSelect={selectAndClose}
                  onSeparate={separate}
                />
              )}

              {status === "ready" && (
                <IdleReadyState
                  availableStems={availableStems}
                  currentStem={currentStem}
                  onSelect={selectAndClose}
                  onSeparate={separate}
                />
              )}

              {status === "cancelled" && <PopText className="mt-0">Cancelled. Open again to retry.</PopText>}
            </div>
          );
        }}
      </Popover>
    </>
  );
};

export { VocalSeparationDropdown };
