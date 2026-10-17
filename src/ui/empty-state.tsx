import type { Icon } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface EmptyStateProps {
  message: string;
  hint: string;
  action?: React.ReactNode;
  icon?: Icon;
}

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<EmptyStateProps> = ({ message, hint, action, icon: StateIcon }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    {StateIcon && <StateIcon aria-hidden="true" className="size-8 mb-1.5 text-composer-text opacity-50" />}
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
    {action}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { EmptyState };
