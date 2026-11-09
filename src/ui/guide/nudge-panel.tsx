import type { GuideNudge } from "@/guide/catalog/types";
import { Button } from "@/ui/button";

// -- Types --------------------------------------------------------------------

interface NudgePanelProps {
  nudge: GuideNudge;
  onTake: () => void;
  onDismiss: () => void;
  onMute: () => void;
}

// -- Component ----------------------------------------------------------------

const NudgePanel: React.FC<NudgePanelProps> = ({ nudge, onTake, onDismiss, onMute }) => (
  <div className="mb-1.5 rounded-[14px] border border-transparent bg-[color-mix(in_oklab,var(--color-composer-accent)_11%,var(--pop))] p-3 shadow-[inset_0_0_0_1px_var(--lit-ring)]">
    <div className="flex items-start gap-2.5">
      <nudge.icon className="mt-0.5 size-4 shrink-0 text-composer-accent-text" stroke={1.75} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-balance">{nudge.title}</div>
        <p className="mt-0.5 text-xs leading-[1.55] text-pretty text-(--label)">{nudge.body}</p>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-1 pl-6.5">
      {nudge.primary && (
        <Button variant="primary" size="sm" onClick={onTake}>
          {nudge.primary.label}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Got it
      </Button>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onMute}>
        No tips like this
      </Button>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { NudgePanel };
