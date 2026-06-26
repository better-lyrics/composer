import { Button } from "@/ui/button";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlConflictNoticeProps {
  onRegenerate: () => void;
}

// -- Components ---------------------------------------------------------------

const TtmlConflictNotice: React.FC<TtmlConflictNoticeProps> = ({ onRegenerate }) => (
  <div
    role="alert"
    className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-lg border border-composer-warning/20 bg-composer-warning/10 px-2.5 py-2 text-xs text-composer-warning"
  >
    <span className="flex items-center gap-2 select-text cursor-text">
      <IconAlertTriangle size={14} className="shrink-0" />
      The lyrics changed since you edited the TTML. Your edits and the new version differ.
    </span>
    <Button hasIcon size="sm" onClick={onRegenerate}>
      <IconRefresh className="size-4" />
      Regenerate
    </Button>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TtmlConflictNotice };
