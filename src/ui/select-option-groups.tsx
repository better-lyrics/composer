import type { ReactNode } from "react";

// -- Components ---------------------------------------------------------------

const OptionGroup: React.FC<{ name?: string; children: ReactNode }> = ({ name, children }) =>
  name ? (
    <div role="group" aria-label={name} className="flex flex-col">
      <hr className="h-px mx-1 mt-1.5 mb-1 border-0 bg-(--divider) in-[[role=group]:first-child]:hidden" />
      <div
        aria-hidden="true"
        className="px-2 pt-1 pb-0.5 text-[11px] leading-4 font-semibold text-(--muted) select-none"
      >
        {name}
      </div>
      {children}
    </div>
  ) : (
    children
  );

// -- Exports ------------------------------------------------------------------

export { OptionGroup };
