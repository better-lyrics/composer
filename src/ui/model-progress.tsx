import { Button } from "@/ui/button";
import { ProgressBar } from "@/ui/progress-bar";
import { COMPACT_BUTTON } from "@/ui/stem-sources/compact-button";

// -- Types --------------------------------------------------------------------

interface ModelProgressProps {
  title: string;
  pct: number;
  /** Shown beside Cancel, for what the run leaves alone or how far it has got. */
  note?: React.ReactNode;
  onCancel: () => void;
}

// -- Component ----------------------------------------------------------------

// A model download or run in a popover: vocal separation and auto-align.
const ModelProgress: React.FC<ModelProgressProps> = ({ title, pct, note, onCancel }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-composer-text">{title}</span>
      <span className="text-xs tabular-nums text-composer-accent-text">{pct}%</span>
    </div>
    <ProgressBar percent={pct} label={title} className="mt-2.5" />
    <div className="flex items-center justify-between gap-3 mt-3">
      <p className="text-xs leading-[1.45] text-(--muted) tabular-nums text-pretty">{note}</p>
      <Button size="sm" variant="secondary" className={COMPACT_BUTTON} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ModelProgress };
