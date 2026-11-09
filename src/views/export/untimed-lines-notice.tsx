import { isLineTimed, isSyncableLine } from "@/domain/line/sync-progress";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { pluralize } from "@/utils/pluralize";
import { IconClockExclamation, IconHandClick } from "@tabler/icons-react";

// -- Component ----------------------------------------------------------------

// A blocking check, not a tip: lines with no timing never show for listeners, so it sits where you export.
const UntimedLinesNotice: React.FC = () => {
  const untimedCount = useProjectStore(
    (state) => state.lines.filter((line) => isSyncableLine(line) && !isLineTimed(line)).length,
  );
  if (untimedCount === 0) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 rounded-xl bg-(--layer-1) py-3.5 pr-3.5 pl-4 shadow-[inset_0_0_0_1px_var(--edge)]"
    >
      <IconClockExclamation aria-hidden="true" className="size-5 shrink-0 text-composer-warning" />
      <p className="min-w-0 cursor-text text-[13px] leading-5 text-pretty text-(--label) select-text">
        <span className="font-medium text-composer-text tabular-nums">{pluralize(untimedCount, "line")}</span>{" "}
        {untimedCount === 1 ? "has" : "have"} no timing yet, so listeners won't see {untimedCount === 1 ? "it" : "them"}
        .
      </p>
      <Button
        hasIcon
        size="sm"
        className="ml-auto shrink-0"
        onClick={() => useProjectStore.getState().setActiveTab("sync")}
      >
        <IconHandClick className="size-4" />
        Sync them
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { UntimedLinesNotice };
