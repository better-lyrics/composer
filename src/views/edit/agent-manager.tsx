import { AGENT_PRESETS, getAgentColor, useProjectStore } from "@/stores/project";
import type { Agent, AgentType } from "@/stores/project";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Helpers ------------------------------------------------------------------

function generateAgentId(existingAgents: { id: string }[]): string {
  const usedNumbers = existingAgents
    .map((a) => a.id.match(/^v(\d+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number.parseInt(m[1], 10));

  let next = 1;
  while (usedNumbers.includes(next)) {
    next++;
  }
  return `v${next}`;
}

// -- Components ---------------------------------------------------------------

const AgentBadge: React.FC<{
  agent: Agent;
  onRemove?: () => void;
  removable?: boolean;
}> = ({ agent, onRemove, removable = true }) => {
  const color = getAgentColor(agent.id);
  const canRemove = removable && onRemove;

  return (
    <div
      className={`relative flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-md bg-composer-button group ${
        canRemove ? "cursor-pointer" : ""
      }`}
      onClick={canRemove ? onRemove : undefined}
    >
      <span className={`flex items-center gap-2 ${canRemove ? "group-hover:opacity-0" : ""} transition-opacity`}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm text-composer-text">{agent.name || agent.id}</span>
        <span className="text-xs text-composer-text-muted">{agent.id}</span>
      </span>
      {canRemove && (
        <span className="absolute inset-0 flex items-center justify-center transition-opacity rounded-md opacity-0 group-hover:opacity-100 bg-composer-error">
          <IconTrash className="w-4 h-4 text-composer-error-text" />
        </span>
      )}
    </div>
  );
};

const AddAgentPopover: React.FC = () => {
  const agents = useProjectStore((s) => s.agents);
  const addAgent = useProjectStore((s) => s.addAgent);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<AgentType>("person");

  const availablePresets = AGENT_PRESETS.filter((preset) => !agents.some((a) => a.id === preset.id));

  const handleAddPreset = useCallback(
    (preset: Agent, close: () => void) => {
      addAgent(preset);
      close();
    },
    [addAgent],
  );

  const handleAddCustom = useCallback(
    (close: () => void) => {
      if (!customName.trim()) return;
      addAgent({
        id: generateAgentId(agents),
        type: customType,
        name: customName.trim(),
      });
      setCustomName("");
      close();
    },
    [addAgent, agents, customName, customType],
  );

  return (
    <Popover
      placement="bottom-start"
      trigger={
        <Button size="sm" hasIcon>
          <IconPlus className="w-3.5 h-3.5" />
          Add
        </Button>
      }
    >
      {(close) => (
        <div className="w-64 p-3">
          {availablePresets.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium text-composer-text-secondary">Presets</p>
              <div className="flex flex-col gap-1 mb-3">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAddPreset(preset, close)}
                    className="flex items-center gap-2 px-2 py-1.5 text-left rounded-md cursor-pointer hover:bg-composer-button"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getAgentColor(preset.id) }}
                    />
                    <span className="text-sm text-composer-text">{preset.name}</span>
                    <span className="text-xs text-composer-text-muted">{preset.id}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mb-2 text-xs font-medium text-composer-text-secondary">Custom Agent</p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Agent name"
              className="px-2 py-1.5 text-sm rounded-md bg-composer-input border border-composer-border focus:outline-none focus:border-composer-accent"
            />
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as AgentType)}
              className="px-2 py-1.5 text-sm rounded-md bg-composer-input border border-composer-border focus:outline-none focus:border-composer-accent cursor-pointer"
            >
              <option value="person">Person</option>
              <option value="group">Group</option>
              <option value="character">Character</option>
              <option value="organization">Organization</option>
              <option value="other">Other</option>
            </select>
            <Button size="sm" variant="primary" onClick={() => handleAddCustom(close)} disabled={!customName.trim()}>
              Add Custom Agent
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
};

const AgentManager: React.FC = () => {
  const agents = useProjectStore((s) => s.agents);
  const removeAgent = useProjectStore((s) => s.removeAgent);
  const lines = useProjectStore((s) => s.lines);
  const setLines = useProjectStore((s) => s.setLines);

  const handleRemoveAgent = useCallback(
    (agentId: string) => {
      // Reassign lines with this agent to the first agent
      const fallbackId = agents.find((a) => a.id !== agentId)?.id ?? "v1";
      const updatedLines = lines.map((line) => (line.agentId === agentId ? { ...line, agentId: fallbackId } : line));
      setLines(updatedLines);
      removeAgent(agentId);
    },
    [agents, lines, setLines, removeAgent],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-composer-text-secondary">Agents</span>
      {agents.map((agent) => (
        <AgentBadge
          key={agent.id}
          agent={agent}
          removable={agents.length > 1}
          onRemove={() => handleRemoveAgent(agent.id)}
        />
      ))}
      <AddAgentPopover />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { AgentManager, AgentBadge };
