// -- Interfaces ---------------------------------------------------------------

interface OptionRun<Option> {
  group?: string;
  start: number;
  options: Option[];
}

// -- Functions ----------------------------------------------------------------

function optionRuns<Option extends { group?: string }>(options: readonly Option[]): OptionRun<Option>[] {
  const runs: OptionRun<Option>[] = [];
  options.forEach((option, index) => {
    const last = runs.at(-1);
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, start: index, options: [option] });
  });
  return runs;
}

// -- Exports ------------------------------------------------------------------

export { optionRuns };
