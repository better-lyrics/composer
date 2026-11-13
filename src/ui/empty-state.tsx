import { type ProjectTab, TAB_LABELS } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import type { Icon } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface EmptyStateProps {
  message: React.ReactNode;
  hint: string;
  goTo?: ProjectTab;
  action?: React.ReactNode;
  icon?: Icon;
}

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<EmptyStateProps> = ({ message, hint, goTo, action, icon: StateIcon }) => (
  <div className="flex flex-col items-center justify-center flex-1 min-w-0 gap-2 text-center">
    {StateIcon && <StateIcon aria-hidden="true" className="size-8 mb-1.5 text-composer-text opacity-50" />}
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
    {goTo && (
      <Button variant="secondary" className="mt-2" onClick={() => useProjectStore.getState().setActiveTab(goTo)}>
        Go to {TAB_LABELS[goTo]}
      </Button>
    )}
    {action}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { EmptyState };
