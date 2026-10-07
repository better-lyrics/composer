import { hasMainLyrics, isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { useAutoAlign } from "@/hooks/use-auto-align";
import { alignmentModelSizeMb, countAlignableLines, isAutoAlignAvailable, useAlignmentStore } from "@/stores/alignment";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { ErrorState, PopActions, PopText, PopTitle, ProgressState } from "@/ui/vocal-separation-states";
import { cn } from "@/utils/cn";
import { formatMegabytes } from "@/utils/format-file-size";
import { pluralize } from "@/utils/pluralize";
import { IconCheck, IconLoader2, IconWand } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface LastRequest {
  realign: boolean;
}

// -- Functions ----------------------------------------------------------------

function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// -- Components ---------------------------------------------------------------

const Step: React.FC<{ done: boolean; label: string; children?: React.ReactNode }> = ({ done, label, children }) => (
  <div>
    <div className="flex items-center gap-2.5 min-h-7 text-[13px] font-medium">
      <span
        className={cn(
          "flex items-center justify-center size-4 rounded-full shrink-0",
          done ? "bg-composer-accent/20" : "border border-(--divider)",
        )}
      >
        {done && <IconCheck aria-hidden="true" className="size-3 text-composer-accent-text" />}
      </span>
      <span className={done ? "text-(--muted)" : "text-composer-text"}>{label}</span>
    </div>
    {children && <div className="pl-6.5 pb-1">{children}</div>}
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
  const sizeMb = alignmentModelSizeMb();
  const hasTaps = counts.lineTimed + counts.wordTimed > 0;

  return (
    <Popover
      placement="bottom-end"
      aria-label="Auto-align words"
      trigger={
        <Button
          variant="ghost"
          size="lg"
          hasIcon
          className="shrink-0 tabular-nums aria-expanded:bg-(--layer-1)"
          aria-label="Auto-align words"
        >
          {busy ? (
            <IconLoader2
              aria-hidden="true"
              className="size-4 text-composer-accent-text animate-spin motion-reduce:animate-none"
            />
          ) : (
            <IconWand aria-hidden="true" className="size-4" />
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
        <div className="w-78 p-3.5">
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
              detail={
                progress.total > 0
                  ? `${formatMegabytes(progress.done)} / ${formatMegabytes(progress.total)}`
                  : "Preparing…"
              }
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
            <div>
              <PopTitle>Auto-align words</PopTitle>
              <PopText>
                Times each word from the separated vocals, using your line timing as a guide. Works for English,
                Mandarin and Japanese lyrics, and follows your transliterations for how Chinese and Japanese lines are
                sung.
              </PopText>

              <div className="grid gap-1 mt-3">
                <Step
                  done={hasTaps}
                  label={
                    counts.untimed > 0 && hasTaps
                      ? `Sync lines (${pluralize(counts.untimed, "line")} left)`
                      : "Sync each line's start and end"
                  }
                >
                  {!hasTaps && <PopText className="mt-0">Tap lines in Line mode first. Rough timing is fine.</PopText>}
                  {!hasTaps && granularity === "word" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => useProjectStore.getState().setGranularity("line")}
                    >
                      Switch to Line mode
                    </Button>
                  )}
                </Step>
                <Step done={hasVocals} label="Separate the vocals">
                  {!hasVocals &&
                    (separating ? (
                      <PopText className="mt-0 tabular-nums">
                        Separating… {percent(separationProgress.loaded, separationProgress.total)}%
                      </PopText>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void useSeparationStore.getState().separate()}
                      >
                        Separate vocals
                      </Button>
                    ))}
                </Step>
              </div>

              {!modelCached && sizeMb && (
                <PopText className="mt-3">Requires a one-time ~{sizeMb} MB model download.</PopText>
              )}

              <PopActions>
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
                {counts.lineTimed > 0 && (
                  <Button size="sm" variant="primary" disabled={!hasVocals} onClick={() => run(false)}>
                    {`${modelCached ? "Align" : "Download & align"} ${pluralize(counts.lineTimed, "line")}`}
                  </Button>
                )}
              </PopActions>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { AutoAlignDropdown };
