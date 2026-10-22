import { pluralWord, pluralize } from "@/utils/pluralize";
import { IconAlertTriangle } from "@tabler/icons-react";

// -- Components ---------------------------------------------------------------

const BracketWarning: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 h-9 px-3 text-[13px] rounded-xl bg-composer-error/10 text-composer-error">
      <IconAlertTriangle className="size-4 shrink-0" />
      <span>
        {pluralize(count, "line")} {pluralWord(count, "contains", "contain")} [brackets]
      </span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BracketWarning };
