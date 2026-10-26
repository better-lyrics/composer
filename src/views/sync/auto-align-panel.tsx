import { hasMainLyrics, isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { useAutoAlign } from "@/hooks/use-auto-align";
import { countAlignableLines, useAlignmentStore } from "@/stores/alignment";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { ModelProgress } from "@/ui/model-progress";
import { COMPACT_BUTTON } from "@/ui/stem-sources/compact-button";
import { StemNotice } from "@/ui/stem-sources/stem-notice";
import { cn } from "@/utils/cn";
import { formatMegabytes } from "@/utils/format-file-size";
import { pluralize } from "@/utils/pluralize";
import { IconCheck, IconLoader2, IconWand } from "@tabler/icons-react";
import { useEffect, useMemo } from "react";

// -- Functions ----------------------------------------------------------------

function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// -- Components ---------------------------------------------------------------

const Hint: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn("mt-0.5 text-xs leading-[1.45] text-(--muted) text-pretty", className)}>{children}</p>
);

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

// What auto-align still needs, its progress and its errors, shared by the Sync
// tab's popover and the Timeline's split button.
const AutoAlignPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const granularity = useProjectStore((s) => s.granularity);
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);
  const error = useAlignmentStore((s) => s.error);
  const modelCached = useAlignmentStore((s) => s.modelCached);
  const sizeMb = useAlignmentStore((s) => s.modelSizeMb);
  const modelId = useSettingsStore((s) => s.alignmentModelId);
  const refreshModelCached = useAlignmentStore((s) => s.refreshModelCached);
  const separationStatus = useSeparationStore((s) => s.status);
  const separationProgress = useSeparationStore((s) => s.progress);
  const hasVocals = useSeparationStore((s) => !!s.stemUrls.vocals);
  const { autoAlign, cancel, retry } = useAutoAlign();

  const counts = useMemo(() => {
    const { lineTimed, wordTimed } = countAlignableLines(lines);
    const untimed = lines.filter((l) => hasMainLyrics(l) && !isWordSynced(l) && !isLineSynced(l)).length;
    return { lineTimed, wordTimed, untimed };
  }, [lines]);

  useEffect(() => {
    void refreshModelCached(modelId);
  }, [refreshModelCached, modelId]);

  const run = (realign: boolean) => {
    void autoAlign(undefined, { allowDownload: true, realign, toastErrors: false });
  };

  const separating = separationStatus === "downloading" || separationStatus === "processing";
  const pct = percent(progress.done, progress.total);
  const hasTaps = counts.lineTimed + counts.wordTimed > 0;

  return (
    <div className="w-80 p-3.5">
      {status === "error" && error && (
        <StemNotice
          tone="negative"
          className="-mx-1.5"
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                className={COMPACT_BUTTON}
                onClick={() => useAlignmentStore.getState().dismissError()}
              >
                Dismiss
              </Button>
              <Button size="sm" variant="primary" className={COMPACT_BUTTON} onClick={retry}>
                Try again
              </Button>
            </>
          }
        >
          <p className="text-[13px] font-medium leading-[1.35] text-composer-text text-pretty">Auto-align failed</p>
          <p className="mt-1.5 text-xs leading-[1.45] text-(--muted) wrap-break-word select-text cursor-text">
            {error.message}
          </p>
        </StemNotice>
      )}

      {status === "downloading" && (
        <ModelProgress
          title={modelCached ? "Loading alignment model…" : "Downloading alignment model…"}
          pct={pct}
          note={
            progress.total > 0 ? `${formatMegabytes(progress.done)} / ${formatMegabytes(progress.total)}` : "Preparing…"
          }
          onCancel={cancel}
        />
      )}

      {status === "running" && (
        <ModelProgress
          title="Aligning words…"
          pct={pct}
          note={`Line ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`}
          onCancel={cancel}
        />
      )}

      {status === "idle" && (
        <div>
          <p className="text-[13.5px] font-bold text-composer-text">Auto-align words</p>
          <Hint className="mt-1.5">
            Times each word from the separated vocals, using your line timing as a guide. Works for English, Mandarin
            and Japanese lyrics, and follows your transliterations for how Chinese and Japanese lines are sung.
          </Hint>

          <div className="grid gap-1 mt-3">
            <Step
              done={hasTaps}
              label={
                counts.untimed > 0 && hasTaps
                  ? `Sync lines (${pluralize(counts.untimed, "line")} left)`
                  : "Sync each line's start and end"
              }
            >
              {!hasTaps && <Hint className="mt-0">Tap lines in Line mode first. Rough timing is fine.</Hint>}
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
                  <Hint className="mt-0 tabular-nums">
                    Separating… {percent(separationProgress.loaded, separationProgress.total)}%
                  </Hint>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void useSeparationStore.getState().separate()}>
                    Separate vocals
                  </Button>
                ))}
            </Step>
          </div>

          {!modelCached && sizeMb && <Hint className="mt-3">Requires a one-time ~{sizeMb} MB model download.</Hint>}

          <div className="flex justify-end gap-2 mt-3.5">
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
          </div>
        </div>
      )}
    </div>
  );
};

/** The trigger's icon and label: a spinner and progress while a run is going. */
const AutoAlignStatus: React.FC<{ idleLabel: string }> = ({ idleLabel }) => {
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);
  const busy = status === "downloading" || status === "running";
  return (
    <>
      {busy ? (
        <IconLoader2
          aria-hidden="true"
          className="size-4 text-composer-accent-text animate-spin motion-reduce:animate-none"
        />
      ) : (
        <IconWand aria-hidden="true" className="size-4" />
      )}
      <span className="tabular-nums">
        {status === "downloading"
          ? `${percent(progress.done, progress.total)}%`
          : status === "running"
            ? `${progress.done}/${progress.total}`
            : idleLabel}
      </span>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { AutoAlignPanel, AutoAlignStatus };
