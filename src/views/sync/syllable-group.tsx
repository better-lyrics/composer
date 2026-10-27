import type { ReactNode } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyllableGroupProps {
  label: string;
  children: ReactNode;
}

// -- Components ---------------------------------------------------------------

const SyllableGroup: React.FC<SyllableGroupProps> = ({ label, children }) => (
  <span className="inline-flex flex-col items-center shrink-0">
    <span className="w-full text-center text-sm text-composer-text-muted border-t border-l border-r border-composer-border rounded-t-lg px-1.5 leading-relaxed">
      {label}
    </span>
    <span className="inline-flex flex-nowrap gap-x-3 bg-composer-button/30 rounded-b-lg px-1.5 py-0.5 border border-composer-border">
      {children}
    </span>
  </span>
);

// -- Exports ------------------------------------------------------------------

export { SyllableGroup };
