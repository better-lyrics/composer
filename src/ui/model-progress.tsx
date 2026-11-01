import { PopActions, PopButton, PopHead, PopText } from "@/ui/pop-layout";
import { ProgressBar } from "@/ui/progress-bar";

// -- Types --------------------------------------------------------------------

interface ModelProgressProps {
  title: string;
  meta: string;
  pct: number;
  note?: React.ReactNode;
  onCancel: () => void;
  onBack?: () => void;
}

// -- Component ----------------------------------------------------------------

const ModelProgress: React.FC<ModelProgressProps> = ({ title, meta, pct, note, onCancel, onBack }) => (
  <>
    <PopHead title={title} meta={meta} onBack={onBack} />
    <ProgressBar percent={pct} label={title} className="h-1.5 mx-2.5 mt-2.5 bg-(--well) shadow-(--well-edge)" />
    {note && <PopText className="mt-2.5">{note}</PopText>}
    <PopActions className="mt-4">
      <PopButton onClick={onCancel}>Cancel</PopButton>
    </PopActions>
  </>
);

// -- Exports ------------------------------------------------------------------

export { ModelProgress };
