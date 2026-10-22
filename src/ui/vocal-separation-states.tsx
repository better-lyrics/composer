import type { Stem } from "@/audio/separation/types";
import { Button } from "@/ui/button";
import { ProgressBar } from "@/ui/progress-bar";
import { STEMS, STEM_ICONS, STEM_LABELS } from "@/ui/stem-labels";
import { VocalOnsetSnapToggle } from "@/ui/vocal-onset-snap-toggle";
import { cn } from "@/utils/cn";
import { IconCheck } from "@tabler/icons-react";

// -- Components ---------------------------------------------------------------

const PopTitle: React.FC<{ children: React.ReactNode; meta?: string }> = ({ children, meta }) => (
  <div className="flex items-baseline justify-between gap-3">
    <p className="text-[13.5px] font-bold text-composer-text">{children}</p>
    {meta && <span className="text-xs tabular-nums text-composer-accent-text">{meta}</span>}
  </div>
);

const PopText: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn("mt-1.5 text-[12.5px] leading-[1.45] text-(--muted) text-pretty", className)}>{children}</p>
);

const PopActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex justify-end gap-2 mt-3.5">{children}</div>
);

const ProgressState: React.FC<{ title: string; detail: string; pct: number; onCancel: () => void }> = ({
  title,
  detail,
  pct,
  onCancel,
}) => (
  <div>
    <PopTitle meta={`${pct}%`}>{title}</PopTitle>
    <PopText className="tabular-nums">{detail}</PopText>
    <ProgressBar percent={pct} label={title} className="h-1.5 w-full mt-3 bg-(--well) shadow-(--well-edge)" />
    <PopActions>
      <Button size="sm" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </PopActions>
  </div>
);

const IdleNoModelState: React.FC<{
  approxMb: number;
  onDownload: () => void;
  onSeparate: () => void;
}> = ({ approxMb, onDownload, onSeparate }) => (
  <div>
    <PopTitle>Vocal separation</PopTitle>
    <PopText>
      Isolate the vocals or hear an instrumental version of this track. Requires a one-time ~{approxMb} MB model
      download.
    </PopText>
    <PopActions>
      <Button size="sm" variant="secondary" onClick={onDownload}>
        Download model
      </Button>
      <Button size="sm" variant="primary" onClick={onSeparate}>
        Download &amp; separate
      </Button>
    </PopActions>
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
    <div>
      <PopTitle>Playback source</PopTitle>
      <div className="grid gap-0.5 -mx-1.5 mt-2">
        {STEMS.map((stem) => {
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
                "flex items-center gap-2.5 h-8.5 pl-2 pr-2.5 rounded-lg text-[13px] font-medium text-left transition-colors",
                selected ? "text-composer-text" : "text-(--label)",
                enabled
                  ? "cursor-pointer hover:bg-(--layer-2) hover:text-composer-text"
                  : "cursor-not-allowed opacity-55",
              )}
            >
              <Icon className="size-4 shrink-0 text-(--muted)" />
              <span className="flex-1">{STEM_LABELS[stem]}</span>
              <IconCheck
                aria-hidden={!selected}
                className={cn("size-4 text-composer-accent-text shrink-0", !selected && "invisible")}
              />
            </button>
          );
        })}
      </div>
      {!hasSeparated && (
        <Button size="sm" variant="primary" onClick={onSeparate} className="w-full mt-2">
          Separate now
        </Button>
      )}
      <div className="h-px my-2.5 bg-(--divider)" />
      <VocalOnsetSnapToggle />
    </div>
  );
};

const ErrorState: React.FC<{ message: string; onRetry: () => void; onDismiss: () => void }> = ({
  message,
  onRetry,
  onDismiss,
}) => (
  <div>
    <PopTitle>Vocal separation failed</PopTitle>
    <PopText className="wrap-break-word select-text">{message}</PopText>
    <PopActions>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
      <Button size="sm" variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </PopActions>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ErrorState, IdleNoModelState, IdleReadyState, PopText, ProgressState };
