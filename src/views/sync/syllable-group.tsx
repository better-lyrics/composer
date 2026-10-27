import { useProjectStore } from "@/stores/project";
import { IconButton } from "@/ui/icon-button";
import { IconArrowMerge } from "@tabler/icons-react";
import type { ReactNode } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyllableGroupMerge {
  lineId: string;
  wordIndex: number;
}

interface SyllableGroupProps {
  label: string;
  merge?: SyllableGroupMerge;
  children: ReactNode;
}

// -- Constants ----------------------------------------------------------------

const MERGE_LABEL = "Merge into one word";

// -- Components ---------------------------------------------------------------

const SyllableGroup: React.FC<SyllableGroupProps> = ({ label, merge, children }) => (
  <span className="group/syllables inline-flex flex-col items-center shrink-0">
    <span className="w-full flex items-center justify-center gap-1 text-sm text-composer-text-muted border-t border-l border-r border-composer-border rounded-t-lg px-1.5 leading-relaxed">
      {label}
      {merge && (
        <span className="transition-opacity opacity-0 group-hover/syllables:opacity-100 focus-within:opacity-100">
          <IconButton
            label={MERGE_LABEL}
            variant="ghost"
            className="size-auto px-1.5 py-0.5 rounded-sm"
            icon={<IconArrowMerge className="size-3" />}
            onClick={(event) => {
              event.stopPropagation();
              useProjectStore.getState().mergeSyllableGroupIntoWord(merge.lineId, "words", [merge.wordIndex]);
            }}
          />
        </span>
      )}
    </span>
    <span className="inline-flex flex-nowrap gap-x-3 bg-composer-button/30 rounded-b-lg px-1.5 py-0.5 border border-composer-border">
      {children}
    </span>
  </span>
);

// -- Exports ------------------------------------------------------------------

export { SyllableGroup };
