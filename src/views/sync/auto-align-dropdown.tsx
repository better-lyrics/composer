import { useAutoAlign } from "@/hooks/use-auto-align";
import { hasMainLyrics, isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { alignmentModelSizeMb, countAlignableLines, isAutoAlignAvailable, useAlignmentStore } from "@/stores/alignment";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { Button } from "@/ui/button";
import { ErrorState, ProgressState } from "@/ui/model-task-states";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { IconCheck, IconLoader2, IconWand } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface LastRequest {
  realign: boolean;
}

// -- Functions ----------------------------------------------------------------

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// -- Components ---------------------------------------------------------------

const Step: React.FC<{ done: boolean; label: string; children?: React.ReactNode }> = ({ done, label, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex items-center justify-center size-4 rounded-full border shrink-0",
          done ? "border-composer-accent bg-composer-accent/20" : "border-composer-border",
        )}
      >
        {done && <IconCheck className="size-3 text-composer-accent" />}
      </span>
      <span className={cn(done ? "text-composer-text-muted" : "text-composer-text")}>{label}</span>
    </div>
    {children && <div className="pl-6">{children}</div>}
  </div>
);

// Word timing from the separated vocals, using each line's tapped timing as
// the guide. Laid out like the vocal separation popover: the trigger shows
// progress, the popover walks through what's still needed.
const AutoAlignDropdown: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const lines = useProjectStore((s) => s.lines);
  const granularity = useProjectStore((s) => s.granularity);
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);
  const error = useAlignmentStore((s) => s.error);
  const modelCached = useAlignmentStore((s) => s.modelCached);
  const refreshModelCached = useAlignmentStore((s) => s.refreshModelCached);
  const separationStatus = useSeparationStore((s) => s.status);
  const separationProgress = useSeparationStore((s) => s.progress);
  const hasVocals = useSeparationStore((s) => !!s.stemUrls.vocals);
  const { autoAlign, cancel } = useAutoAlign();
  const lastRequest = useRef<LastRequest>({ realign: false });

  const counts = useMemo(() => {
    const { lineTimed, wordTimed } = countAlignableLines(lines);
    const untimed = lines.filter((l) => hasMainLyrics(l) && !isWordSynced(l) && !isLineSynced(l)).length;
    return { lineTimed, wordTimed, untimed };
  }, [lines]);

  useEffect(() => {
    void refreshModelCached();
  }, [refreshModelCached]);

  if (!isAutoAlignAvailable() || !source) return null;

  const run = (realign: boolean) => {
    lastRequest.current = { realign };
    void autoAlign(undefined, { allowDownload: true, realign, toastErrors: false });
  };

  const busy = status === "downloading" || status === "running";
  const separating = separationStatus === "downloading" || separationStatus === "processing";
  const pct = percent(progress.done, progress.total);
  const triggerIconClass = "size-4 text-composer-text opacity-50 group-hover:opacity-100 transition-opacity";
  const sizeMb = alignmentModelSizeMb();
  const hasTaps = counts.lineTimed + counts.wordTimed > 0;

  return (
    <Popover
      placement="bottom-end"
      trigger={
        <Button variant="ghost" size="sm" hasIcon className="group tabular-nums" aria-label="Auto-align words">
          {busy ? (
            <IconLoader2 className={`${triggerIconClass} animate-spin`} />
          ) : (
            <IconWand className={triggerIconClass} />
          )}
          <span>
            {status === "downloading"
              ? `${pct}%`
              : status === "running"
                ? `${progress.done}/${progress.total}`
                : "Auto-align"}
          </span>
        </Button>
      }
    >
      {() => (
        <div className="p-3 w-80">
          {status === "error" && error && (
            <ErrorState
              title="Auto-align failed"
              message={error.message}
              onRetry={() => run(lastRequest.current.realign)}
              onDismiss={() => useAlignmentStore.getState().dismissError()}
            />
          )}

          {status === "downloading" && (
            <ProgressState
              title={modelCached ? "Loading alignment model…" : "Downloading alignment model…"}
              detail={progress.total > 0 ? `${formatMb(progress.done)} / ${formatMb(progress.total)}` : "Preparing…"}
              pct={pct}
              onCancel={cancel}
            />
          )}

          {status === "running" && (
            <ProgressState
              title="Aligning words…"
              detail={`Line ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`}
              pct={pct}
              onCancel={cancel}
            />
          )}

          {status === "idle" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-composer-text">Auto-align words</p>
                <p className="text-xs text-composer-text-muted">
                  Times each word from the separated vocals, using your line timing as a guide. Works for English,
                  Mandarin and Japanese lyrics.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Step
                  done={hasTaps}
                  label={
                    counts.untimed > 0 && hasTaps
                      ? `Sync lines (${pluralize(counts.untimed, "line")} left)`
                      : "Sync each line's start and end"
                  }
                >
                  {!hasTaps && (
                    <p className="text-xs text-composer-text-muted">
                      Tap lines in Line mode first. Rough timing is fine.
                    </p>
                  )}
                  {!hasTaps && granularity === "word" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      onClick={() => useProjectStore.getState().setGranularity("line")}
                    >
                      Switch to Line mode
                    </Button>
                  )}
                </Step>
                <Step done={hasVocals} label="Separate the vocals">
                  {!hasVocals &&
                    (separating ? (
                      <p className="text-xs text-composer-text-muted tabular-nums">
                        Separating… {percent(separationProgress.loaded, separationProgress.total)}%
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-1"
                        onClick={() => void useSeparationStore.getState().separate()}
                      >
                        Separate vocals
                      </Button>
                    ))}
                </Step>
              </div>

              {!modelCached && sizeMb && (
                <p className="text-xs text-composer-text-muted">Requires a one-time ~{sizeMb} MB model download.</p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                {counts.lineTimed > 0 && (
                  <Button size="sm" variant="primary" disabled={!hasVocals} onClick={() => run(false)}>
                    {`${modelCached ? "Align" : "Download & align"} ${pluralize(counts.lineTimed, "line")}`}
                  </Button>
                )}
                {counts.wordTimed > 0 && (
                  <Button
                    size="sm"
                    variant={counts.lineTimed > 0 ? "secondary" : "primary"}
                    disabled={!hasVocals}
                    onClick={() => run(true)}
                    title="Redo word timing for every timed line, using each line's current span as the guide"
                  >
                    {`Re-align all ${pluralize(counts.lineTimed + counts.wordTimed, "line")}`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { AutoAlignDropdown };
