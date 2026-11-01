import { ToggleButton } from "@/ui/toggle-button";

// -- Interfaces ----------------------------------------------------------------

interface StateChip<T extends string> {
  id: T;
  label: string;
  // Absent when only an interaction with the component can enter the state.
  enter?: () => void;
  hint?: string;
}

interface StateChipsProps<T extends string> {
  label: string;
  states: readonly StateChip<T>[];
  current: T;
}

// -- Components ----------------------------------------------------------------

function StateChips<T extends string>({ label, states, current }: StateChipsProps<T>) {
  const currentLabel = states.find((state) => state.id === current)?.label ?? current;
  return (
    <div className="flex flex-col gap-2 select-none">
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {states.map((state) => (
          <ToggleButton
            key={state.id}
            size="sm"
            pressed={state.id === current}
            disabled={!state.enter && state.id !== current}
            title={state.enter ? undefined : state.hint}
            onClick={state.enter}
          >
            {state.label}
          </ToggleButton>
        ))}
      </div>
      <p role="status" className="text-xs text-(--muted)">
        {`Now: ${currentLabel}`}
        {states.some((state) => !state.enter) && ". Use the component to reach the dimmed states."}
      </p>
    </div>
  );
}

// -- Exports -------------------------------------------------------------------

export { StateChips };
export type { StateChip };
