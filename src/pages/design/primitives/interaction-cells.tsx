import { StateCell } from "@/pages/design/state-cell";

// -- Interfaces ----------------------------------------------------------------

interface InteractionCellsProps {
  render: (disabled: boolean) => React.ReactNode;
  withDefault?: boolean;
  withDisabled?: boolean;
}

// -- Components ----------------------------------------------------------------

const InteractionCells: React.FC<InteractionCellsProps> = ({ render, withDefault = true, withDisabled = true }) => (
  <>
    {withDefault && <StateCell label="Hover, press or Tab to it">{render(false)}</StateCell>}
    {withDisabled && <StateCell label="Disabled">{render(true)}</StateCell>}
  </>
);

const ResultLine: React.FC<{ result: string | null }> = ({ result }) => (
  <p role="status" className="min-h-4 text-xs text-(--muted) select-none">
    {result}
  </p>
);

// -- Exports -------------------------------------------------------------------

export { InteractionCells, ResultLine };
