import { IconZoomQuestion } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface NoMatchesProps {
  message: string;
  hint?: string;
  action?: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

const NoMatches: React.FC<NoMatchesProps> = ({ message, hint, action }) => (
  <output className="m-auto flex flex-col items-center px-4 text-center">
    <IconZoomQuestion size={22} className="text-composer-text opacity-25 mb-2" aria-hidden="true" />
    <span className="text-xs font-medium text-composer-text-secondary select-text">{message}</span>
    {hint && <span className="text-[11px] text-composer-text-muted mt-0.5">{hint}</span>}
    {action && <div className="mt-3">{action}</div>}
  </output>
);

// -- Exports -------------------------------------------------------------------

export { NoMatches };
