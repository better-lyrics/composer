import { getModelDescriptor } from "@/audio/separation/model-registry";
import type { Stem } from "@/audio/separation/types";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { ProgressBar } from "@/ui/progress-bar";
import { VocalOnsetSnapToggle } from "@/ui/vocal-onset-snap-toggle";
import { DETECTING_VOCAL_ONSETS } from "@/ui/vocal-onset-status-copy";
import { cn } from "@/utils/cn";
import { formatMegabytes } from "@/utils/format-file-size";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconCheck, IconLoader2, IconMicrophone, IconMusic, type IconProps, IconWaveSine } from "@tabler/icons-react";
import { type ComponentType, useEffect } from "react";

const STEM_LABELS: Record<Stem, string> = {
  original: "Original",
  vocals: "Vocals",
  instrumental: "Instrumental",
};

const STEM_ICONS: Record<Stem, ComponentType<IconProps>> = {
  original: IconWaveSine,
  vocals: IconMicrophone,
  instrumental: IconMusic,
};

const VocalSeparationDropdown: React.FC = () => {
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
  const triggerIconClass = "size-4 text-composer-text opacity-50 group-hover:opacity-100 transition-opacity";
  const triggerIcon =
    separating || showDetecting ? (
      <IconLoader2 className={`${triggerIconClass} animate-spin`} />
    ) : (
      <IconMicrophone className={triggerIconClass} />
    );

  return (
    <>
      <span role="status" aria-atomic="true" className="sr-only">
        {showDetecting ? DETECTING_VOCAL_ONSETS : ""}
      </span>
      <Popover
        placement="top-end"
        trigger={
          <Button variant="ghost" hasIcon className="group font-mono tabular-nums min-w-20" aria-label={triggerName}>
            {triggerIcon}
            <span>{triggerLabel}</span>
          </Button>
        }
      >
        {(close) => {
          const selectAndClose = (stem: Stem) => {
            selectStem(stem);
            close();
          };
          return (
            <div className="p-3 w-max max-w-80">
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

              {status === "cancelled" && (
                <p className="text-xs text-composer-text-muted">Cancelled. Open again to retry.</p>
              )}
            </div>
          );
        }}
      </Popover>
    </>
  );
};

const ProgressState: React.FC<{ title: string; detail: string; pct: number; onCancel: () => void }> = ({
  title,
  detail,
  pct,
  onCancel,
}) => (
  <div className="flex flex-col gap-2 min-w-60">
    <p className="text-sm font-medium text-composer-text">{title}</p>
    <p className="text-xs text-composer-text-muted tabular-nums">{detail}</p>
    <ProgressBar percent={pct} label={title} className="h-1.5 w-full" />
    <div className="flex justify-end pt-1">
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  </div>
);

const IdleNoModelState: React.FC<{
  approxMb: number;
  onDownload: () => void;
  onSeparate: () => void;
}> = ({ approxMb, onDownload, onSeparate }) => (
  <div className="flex flex-col gap-2">
    <p className="text-sm font-medium text-composer-text">Vocal separation</p>
    <p className="text-xs text-composer-text-muted">
      Isolate the vocals or hear an instrumental version of this track. Requires a one-time ~{approxMb} MB model
      download.
    </p>
    <div className="flex gap-2 pt-1">
      <Button size="sm" variant="secondary" onClick={onDownload}>
        Download model
      </Button>
      <Button size="sm" variant="primary" onClick={onSeparate}>
        Download &amp; separate
      </Button>
    </div>
  </div>
);

const IdleReadyState: React.FC<{
  availableStems: Stem[];
  currentStem: Stem;
  onSelect: (stem: Stem) => void;
  onSeparate: () => void;
}> = ({ availableStems, currentStem, onSelect, onSeparate }) => {
  const hasSeparated = availableStems.includes("vocals");
  return (
    <div className="flex flex-col gap-2 min-w-60">
      <p className="text-sm font-medium text-composer-text">Playback source</p>
      <div className="flex flex-col gap-0.5">
        {(["original", "vocals", "instrumental"] as Stem[]).map((stem) => {
          const enabled = stem === "original" || availableStems.includes(stem);
          const selected = currentStem === stem;
          const Icon = STEM_ICONS[stem];
          return (
            <button
              key={stem}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(stem)}
              className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left text-composer-text transition-colors",
                selected && "bg-composer-button font-medium",
                !selected && enabled && "cursor-pointer hover:bg-composer-button",
                !enabled && "cursor-not-allowed opacity-55",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  selected ? "text-composer-accent-text" : "text-composer-text opacity-55",
                )}
              />
              <span className="flex-1">{STEM_LABELS[stem]}</span>
              <IconCheck
                aria-hidden={!selected}
                className={cn("size-3.5 text-composer-accent shrink-0", !selected && "invisible")}
              />
            </button>
          );
        })}
      </div>
      {!hasSeparated && (
        <Button size="sm" variant="primary" onClick={onSeparate} className="mt-1">
          Separate now
        </Button>
      )}
      <div className="border-t border-composer-border pt-2 mt-1">
        <VocalOnsetSnapToggle />
      </div>
    </div>
  );
};

const ErrorState: React.FC<{ message: string; onRetry: () => void; onDismiss: () => void }> = ({
  message,
  onRetry,
  onDismiss,
}) => (
  <div className="flex flex-col gap-2">
    <p className="text-sm font-medium text-composer-text">Vocal separation failed</p>
    <p className="text-xs text-composer-text-muted break-words">{message}</p>
    <div className="flex gap-2 pt-1 justify-end">
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
      <Button size="sm" variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  </div>
);

export { VocalSeparationDropdown };
