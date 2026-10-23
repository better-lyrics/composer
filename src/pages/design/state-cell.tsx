import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface StateCellProps {
  label: string;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

const StateCell: React.FC<StateCellProps> = ({ label, children }) => (
  <figure className="flex flex-col gap-2 min-w-0">
    <div className="flex items-center justify-center min-h-20 p-4 rounded-xl bg-(--well) shadow-(--well-edge)">
      {children}
    </div>
    <figcaption className="text-xs text-(--muted) select-none">{label}</figcaption>
  </figure>
);

const StateGrid: React.FC<{ wide?: boolean; children: React.ReactNode }> = ({ wide = false, children }) => (
  <div
    className={cn(
      "grid gap-3",
      wide ? "grid-cols-[repeat(auto-fill,minmax(260px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]",
    )}
  >
    {children}
  </div>
);

const PrimitiveBlock: React.FC<{ name: string; note: string; children: React.ReactNode }> = ({
  name,
  note,
  children,
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-0.5 select-none">
      <h3 className="text-[14.5px] font-semibold text-composer-text">{name}</h3>
      <p className="text-sm text-composer-text-secondary text-pretty">{note}</p>
    </div>
    {children}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { PrimitiveBlock, StateCell, StateGrid };
