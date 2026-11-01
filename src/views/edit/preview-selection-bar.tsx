import { getAgentColor } from "@/domain/agent/colors";
import { useProjectStore } from "@/stores/project";
import { Select } from "@/ui/select";
import { SingerTag } from "@/ui/singer-tag";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

interface PreviewSelectionBarProps {
  selectedCount: number;
  onAssignAgent: (agentId: string) => void;
  onClear: () => void;
}

// -- Components ---------------------------------------------------------------

// The Preview heading, with the bulk actions for the selected lines beside it.
const PreviewSelectionBar: React.FC<PreviewSelectionBarProps> = ({ selectedCount, onAssignAgent, onClear }) => {
  const agents = useProjectStore((s) => s.agents);
  return (
    <div className="flex items-center justify-between h-7 mb-2">
      <span className="text-[13px] font-medium select-none text-(--label)">Preview</span>
      <div
        className={cn(
          "flex items-center gap-2 transition-opacity",
          selectedCount > 0 ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <span className="text-xs text-(--muted)">{pluralize(selectedCount, "line")} selected</span>
        {agents.length > 1 && (
          <Select
            aria-label="Assign agent"
            placeholder="Assign agent"
            value=""
            onChange={onAssignAgent}
            options={agents.map((agent) => ({ value: agent.id, label: agent.name || agent.id }))}
            appearance="pick"
            renderOption={(option) => <SingerTag color={getAgentColor(option.value)}>{option.label}</SingerTag>}
          />
        )}
        <button
          type="button"
          onClick={onClear}
          className="h-6 px-1.5 rounded-md text-xs cursor-pointer text-(--muted) hover:text-composer-text hover:bg-(--layer-2)"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PreviewSelectionBar };
