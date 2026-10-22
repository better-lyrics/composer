import { Button } from "@/ui/button";
import { IconAlertTriangle, IconCheck, IconRefresh } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface TtmlConflictNoticeProps {
  onRegenerate: () => void;
  onKeepEdits: () => void;
}

// -- Components ---------------------------------------------------------------

const TtmlConflictNotice: React.FC<TtmlConflictNoticeProps> = ({ onRegenerate, onKeepEdits }) => (
  <div
    role="alert"
    className="flex shrink-0 items-center gap-2.5 min-h-10 py-1 pr-1 pl-3 rounded-xl text-[13px] text-[color-mix(in_oklab,var(--color-composer-warning)_80%,var(--ink))] bg-composer-warning/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-warning)_20%,transparent)]"
  >
    <IconAlertTriangle aria-hidden="true" className="size-4 shrink-0 text-composer-warning" />
    <span className="select-text cursor-text">
      The lyrics changed since you edited the TTML. Exporting now uses your edits, not the new version.
    </span>
    <span className="ml-auto flex shrink-0 items-center gap-1">
      <Button hasIcon size="sm" onClick={onKeepEdits} className="pl-2.5 text-[13px]">
        <IconCheck className="size-4" />
        Keep my edits
      </Button>
      <Button hasIcon size="sm" onClick={onRegenerate} className="pl-2.5 text-[13px]">
        <IconRefresh className="size-4" />
        Regenerate
      </Button>
    </span>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TtmlConflictNotice };
