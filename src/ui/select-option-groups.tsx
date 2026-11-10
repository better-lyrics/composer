import type { ReactNode } from "react";

// -- Interfaces ---------------------------------------------------------------

interface OptionRun<Option> {
  group?: string;
  start: number;
  options: Option[];
}

// -- Helpers ------------------------------------------------------------------

function optionRuns<Option extends { group?: string }>(options: readonly Option[]): OptionRun<Option>[] {
  const runs: OptionRun<Option>[] = [];
  options.forEach((option, index) => {
    const last = runs.at(-1);
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, start: index, options: [option] });
  });
  return runs;
}

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

export { OptionGroup, optionRuns };
