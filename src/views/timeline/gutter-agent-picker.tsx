import { getAgentColor } from "@/domain/agent/colors";
import { useProjectStore } from "@/stores/project";
import { IconButton } from "@/ui/icon-button";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Popover } from "@/ui/popover";
import { Scroll } from "@/ui/scroll";
import { SingerTag } from "@/ui/singer-tag";
import { cn } from "@/utils/cn";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Types --------------------------------------------------------------------

interface GutterAgentPickerProps {
  lineId: string;
  lineIndex: number;
  agentId: string;
  numberHeight: number;
}

// -- Component ----------------------------------------------------------------

const GutterAgentPicker: React.FC<GutterAgentPickerProps> = ({ lineId, lineIndex, agentId, numberHeight }) => {
  const agents = useProjectStore((s) => s.agents);
  const addAgent = useProjectStore((s) => s.addAgent);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const [newAgentName, setNewAgentName] = useState("");

  const handleAssign = useCallback(
    (newAgentId: string, close: () => void) => {
      updateLineWithHistory(lineId, { agentId: newAgentId });
      close();
    },
    [lineId, updateLineWithHistory],
  );

  const handleAddNew = useCallback(
    (close: () => void) => {
      if (!newAgentName.trim()) return;
      const usedNumbers = new Set<number>();
      for (const a of agents) {
        const m = a.id.match(/^v(\d+)$/);
        if (m) usedNumbers.add(Number.parseInt(m[1], 10));
      }
      let next = 1;
      while (usedNumbers.has(next)) next++;
      const newId = `v${next}`;
      addAgent({ id: newId, type: "person", name: newAgentName.trim() });
      updateLineWithHistory(lineId, { agentId: newId });
      setNewAgentName("");
      close();
    },
    [lineId, agents, newAgentName, addAgent, updateLineWithHistory],
  );

  return (
    <Popover
      instant
      placement="right-start"
      trigger={
        <button
          type="button"
          className="size-full flex justify-center items-start cursor-pointer"
          title="Assign agent"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const { setContextMenu } = useTimelineStore.getState();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              target: { kind: "gutter", lineId, lineIndex },
            });
          }}
        >
          <span
            className="grid place-items-center font-mono font-medium text-xs leading-none tabular-nums text-(--muted) transition-colors duration-[280ms] group-data-current/row:font-semibold group-data-current/row:text-composer-text"
            style={{ height: numberHeight }}
          >
            {lineIndex + 1}
          </span>
        </button>
      }
    >
      {(close) => (
        <div className="flex flex-col w-56 min-h-0 p-1.5">
          <p className="px-2 pt-1.5 pb-1 text-xs text-(--muted)">Assign agent</p>
          <Scroll className="min-h-0 max-h-74">
            <div className="flex flex-col gap-px">
              {agents.map((agent) => {
                const isActive = agent.id === agentId;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAssign(agent.id, close)}
                    className={cn(
                      "flex items-center justify-between gap-2 h-9 px-2 rounded-lg cursor-pointer hover:bg-(--layer-2)",
                      isActive && "bg-(--layer-1)",
                    )}
                  >
                    <SingerTag color={getAgentColor(agent.id)}>{agent.name || agent.id}</SingerTag>
                    {isActive && <IconCheck aria-hidden="true" className="size-4 shrink-0 text-composer-accent-text" />}
                  </button>
                );
              })}
            </div>
          </Scroll>
          <div className="flex gap-1 mt-1.5 pt-1.5 border-t border-(--divider)">
            <input
              type="text"
              aria-label="New agent name"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleAddNew(close);
              }}
              placeholder="New agent name"
              className={cn(INPUT_STYLES, "flex-1 min-w-0 h-8 py-0")}
            />
            <IconButton
              label="Add agent"
              icon={<IconPlus size={16} />}
              variant="ghost"
              onClick={() => handleAddNew(close)}
              disabled={!newAgentName.trim()}
            />
          </div>
        </div>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { GutterAgentPicker };
