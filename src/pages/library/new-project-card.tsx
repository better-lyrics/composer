import { IconPlus } from "@tabler/icons-react";
import { cn } from "@/utils/cn";

// -- Interfaces ---------------------------------------------------------------

interface NewProjectCardProps {
  onClick: () => void;
}

// -- Component ----------------------------------------------------------------

const NewProjectCard: React.FC<NewProjectCardProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group flex flex-col items-center justify-center text-center select-none",
      "aspect-square rounded-xl cursor-pointer",
      "border border-dashed border-composer-border bg-transparent text-composer-text-muted",
      "transition-[border-color,background-color,color] duration-150",
      "hover:border-composer-accent hover:text-composer-text",
      "hover:bg-composer-accent/5",
    )}
  >
    <span
      className={cn(
        "inline-flex items-center justify-center size-9 rounded-full mb-2",
        "bg-composer-accent/15 text-composer-accent-text",
      )}
    >
      <IconPlus className="size-5" />
    </span>
    <span className="text-xs font-semibold">New project</span>
    <span className="mt-0.5 text-[11px] text-composer-text-muted">Drop or click</span>
  </button>
);

// -- Exports ------------------------------------------------------------------

export { NewProjectCard };
