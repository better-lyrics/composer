import { AGENT_PRESETS, getAgentColor } from "@/domain/agent/colors";
import type { Agent, AgentType } from "@/domain/agent/model";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Popover } from "@/ui/popover";
import { Select } from "@/ui/select";
import { SingerTag } from "@/ui/singer-tag";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { IconChevronDown, IconChevronLeft, IconMicrophone2, IconPlus, IconTrash } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Types --------------------------------------------------------------------

type AgentsView = { kind: "list" } | { kind: "edit"; agent: Agent } | { kind: "add" };

// -- Constants ----------------------------------------------------------------

const AGENT_TYPE_OPTIONS = [
  { value: "person", label: "Person" },
  { value: "group", label: "Group" },
  { value: "character", label: "Character" },
  { value: "organization", label: "Organization" },
  { value: "other", label: "Other" },
];

const FIELD = cn(INPUT_STYLES, "h-8 py-0");

// -- Helpers ------------------------------------------------------------------

function generateAgentId(existingAgents: { id: string }[]): string {
  const usedNumbers = new Set<number>();
  for (const a of existingAgents) {
    const m = a.id.match(/^v(\d+)$/);
    if (m) usedNumbers.add(Number.parseInt(m[1], 10));
  }

  let next = 1;
  while (usedNumbers.has(next)) {
    next++;
  }
  return `v${next}`;
}

// -- Components ---------------------------------------------------------------

const FormHeader: React.FC<{ title: string; id?: string; onBack: () => void }> = ({ title, id, onBack }) => (
  <div className="flex items-center justify-between gap-2 px-0.5">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-[13.5px] font-bold text-composer-text cursor-pointer"
    >
      <IconChevronLeft className="size-[15px] text-(--muted)" />
      {title}
    </button>
    {id && <span className="font-mono text-[11px] font-medium text-composer-text-muted">{id}</span>}
  </div>
);

const EditAgentForm: React.FC<{
  agent: Agent;
  removable: boolean;
  onRemove: () => void;
  onDone: () => void;
  onBack: () => void;
}> = ({ agent, removable, onRemove, onDone, onBack }) => {
  const updateAgent = useProjectStore((s) => s.updateAgent);
  const [name, setName] = useState(() => agent.name || "");
  const [type, setType] = useState<AgentType>(() => agent.type);

  const handleSave = useCallback(() => {
    updateAgent(agent.id, { name: name.trim() || undefined, type });
    onDone();
  }, [updateAgent, agent.id, name, type, onDone]);

  return (
    <div className="flex flex-col gap-2 p-1.5">
      <FormHeader title="Edit agent" id={agent.id} onBack={onBack} />
      <input
        type="text"
        aria-label="Agent name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Agent name"
        className={FIELD}
      />
      <Select
        aria-label="Agent type"
        value={type}
        onChange={(next) => setType(next as AgentType)}
        options={AGENT_TYPE_OPTIONS}
        placement="bottom-start"
        appearance="pick"
        className="w-full h-8 pl-2.5 pr-2 rounded-lg text-[13px]"
      />
      <div className="flex gap-2 mt-0.5">
        <Button variant="primary" onClick={handleSave} className="flex-1 h-[30px]">
          Save
        </Button>
        {removable && (
          <IconButton
            label="Delete agent"
            icon={<IconTrash className="size-4" />}
            variant="destructive"
            onClick={() => {
              onRemove();
              onDone();
            }}
            className="size-[30px]"
          />
        )}
      </div>
    </div>
  );
};

const AddAgentForm: React.FC<{ onDone: () => void; onBack: () => void }> = ({ onDone, onBack }) => {
  const agents = useProjectStore((s) => s.agents);
  const addAgent = useProjectStore((s) => s.addAgent);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<AgentType>("person");
  const availablePresets = AGENT_PRESETS.filter((preset) => !agents.some((a) => a.id === preset.id));

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    addAgent({ id: generateAgentId(agents), type: customType, name: customName.trim() });
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 p-1.5">
      <FormHeader title="Add agent" onBack={onBack} />
      {availablePresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availablePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                addAgent(preset);
                onDone();
              }}
              className="cursor-pointer rounded-[7px] hover:brightness-125"
            >
              <SingerTag color={getAgentColor(preset.id)}>{preset.name}</SingerTag>
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        aria-label="Custom agent name"
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        placeholder="Agent name"
        className={FIELD}
      />
      <Select
        aria-label="Custom agent type"
        value={customType}
        onChange={(next) => setCustomType(next as AgentType)}
        options={AGENT_TYPE_OPTIONS}
        placement="bottom-start"
        appearance="pick"
        className="w-full h-8 pl-2.5 pr-2 rounded-lg text-[13px]"
      />
      <Button variant="primary" onClick={handleAddCustom} disabled={!customName.trim()} className="h-[30px] mt-0.5">
        Add Custom Agent
      </Button>
    </div>
  );
};

const AgentList: React.FC<{ onEdit: (agent: Agent) => void; onAdd: () => void }> = ({ onEdit, onAdd }) => {
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  return (
    <div>
      <p className="px-2 pt-2 pb-1.5 text-[13.5px] font-bold text-composer-text">Agents</p>
      <div className="grid grid-cols-[minmax(0,max-content)_1fr_auto] max-h-74 overflow-x-hidden overflow-y-auto overscroll-none">
        {agents.map((agent) => {
          const lineCount = lines.filter((line) => line.agentId === agent.id).length;
          return (
            <button
              key={agent.id}
              type="button"
              title="Edit agent"
              onClick={() => onEdit(agent)}
              className="grid grid-cols-subgrid col-span-full items-center gap-x-2.5 h-9 pl-2 pr-2.5 rounded-lg text-left cursor-pointer hover:bg-(--layer-1)"
            >
              <SingerTag color={getAgentColor(agent.id)} className="justify-self-start">
                {agent.name || agent.id}
              </SingerTag>
              <span className="font-mono text-[11px] text-composer-text-muted">{agent.id}</span>
              <span className="text-xs text-right tabular-nums text-(--muted)">{pluralize(lineCount, "line")}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 pt-1 shadow-[inset_0_1px_0_var(--divider)]">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 w-full h-[34px] px-2 rounded-lg text-[13px] cursor-pointer text-(--label) hover:bg-(--layer-1) hover:text-composer-text"
        >
          <IconPlus className="size-[18px]" />
          Add agent
        </button>
      </div>
    </div>
  );
};

const AgentsPopoverBody: React.FC<{ close: () => void }> = ({ close }) => {
  const agents = useProjectStore((s) => s.agents);
  const removeAgentWithHistory = useProjectStore((s) => s.removeAgentWithHistory);
  const [view, setView] = useState<AgentsView>({ kind: "list" });
  const showList = () => setView({ kind: "list" });

  return (
    <div className="w-75 p-1.5">
      {view.kind === "list" && (
        <AgentList onEdit={(agent) => setView({ kind: "edit", agent })} onAdd={() => setView({ kind: "add" })} />
      )}
      {view.kind === "edit" && (
        <EditAgentForm
          agent={view.agent}
          removable={agents.length > 1}
          onRemove={() => removeAgentWithHistory(view.agent.id)}
          onDone={close}
          onBack={showList}
        />
      )}
      {view.kind === "add" && <AddAgentForm onDone={close} onBack={showList} />}
    </div>
  );
};

const AgentManager: React.FC = () => {
  const agentCount = useProjectStore((s) => s.agents.length);
  return (
    <Popover
      placement="bottom-start"
      trigger={
        <Button
          size="lg"
          hasIcon
          className="pr-[5px] aria-expanded:[background:var(--raised-face-hover)] aria-expanded:text-composer-text"
        >
          <IconMicrophone2 className="size-4" />
          Agents
          <span className="-ml-px text-(--muted) tabular-nums">{agentCount}</span>
          <IconChevronDown className="size-3.5 opacity-50 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90" />
        </Button>
      }
    >
      {(close) => <AgentsPopoverBody close={close} />}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { AgentManager };
