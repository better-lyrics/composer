import { getAgentColor } from "@/domain/agent/colors";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Popover } from "@/ui/popover";
import { Select } from "@/ui/select";
import { SingerTag } from "@/ui/singer-tag";
import { classifyLine } from "@/utils/background-vocal-extraction";
import { cn } from "@/utils/cn";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconAlertTriangle, IconArrowBackUp, IconChevronDown, IconMicrophone } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LinePreviewActionsProps {
  line: ParsedLine;
  agents: { id: string; name?: string }[];
  agentColor: string;
  editsSelection: boolean;
  onAgentChange: (lineId: string, agentId: string) => void;
  onBulkAgentChange: (agentId: string) => void;
  onBackgroundChange: (lineId: string, text: string) => void;
  onExtractLine: (lineId: string) => void;
}

// -- Components ---------------------------------------------------------------

const BackgroundTextInput: React.FC<{
  initialText: string;
  onCommit: (text: string) => void;
  onClose: () => void;
}> = ({ initialText, onCommit, onClose }) => {
  const [text, setText] = useState(initialText);
  const commitIfEdited = () => {
    if (text !== initialText) onCommit(text);
  };

  return (
    <input
      type="text"
      aria-label="Background vocals text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commitIfEdited}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commitIfEdited();
          onClose();
        }
      }}
      placeholder="ooh, ah, etc."
      className={cn(INPUT_STYLES, "w-full h-8 py-0")}
    />
  );
};

const LinePreviewActions: React.FC<LinePreviewActionsProps> = ({
  line,
  agents,
  agentColor,
  editsSelection,
  onAgentChange,
  onBulkAgentChange,
  onBackgroundChange,
  onExtractLine,
}) => (
  <div className="flex items-center gap-1.5 ml-auto transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
    {agents.length > 1 && line.lineId && (
      <Select
        aria-label="Line agent"
        value={line.agentId}
        onChange={(next) => {
          if (editsSelection) onBulkAgentChange(next);
          else onAgentChange(line.lineId, next);
        }}
        options={agents.map((agent) => ({ value: agent.id, label: agent.name || agent.id }))}
        renderOption={(option) => <SingerTag color={getAgentColor(option.value)}>{option.label}</SingerTag>}
        trigger={
          <button
            type="button"
            aria-label="Line agent"
            className="singer-tag max-w-40! cursor-pointer hover:bg-[color-mix(in_oklab,var(--agent)_24%,transparent)] focus-visible:bg-[color-mix(in_oklab,var(--agent)_24%,transparent)]"
            style={{ "--agent": agentColor }}
          >
            <span className="truncate">{agents.find((agent) => agent.id === line.agentId)?.name || line.agentId}</span>
            <IconChevronDown className="size-[13px] -mr-[3px] opacity-60 transition-[rotate,opacity] in-aria-expanded:rotate-180 in-aria-expanded:opacity-90" />
          </button>
        }
      />
    )}

    {line.lineId && (
      <Popover
        placement="bottom-start"
        trigger={
          <button
            type="button"
            className="flex items-center gap-1 h-[22px] pl-[5px] pr-[7px] rounded-[7px] text-[11.5px] cursor-pointer bg-(--layer-2) hover:bg-(--layer-3) text-(--muted) hover:text-composer-text"
          >
            <IconMicrophone className="size-[13px]" />
            BG
          </button>
        }
      >
        {(close) => (
          <div className="flex flex-col gap-2 w-[220px] p-3">
            <p className="text-[13.5px] font-bold text-composer-text">Background vocals</p>
            {classifyLine(line.text).kind === "inline" && (
              // react-doctor-disable-next-line react-doctor/html-no-nested-interactive -- lives in a portalled popover, so it is not nested in the row in the DOM
              <button
                type="button"
                onClick={() => {
                  if (line.lineId) onExtractLine(line.lineId);
                  close();
                }}
                className="flex w-full items-center gap-1 px-0.5 text-xs cursor-pointer text-composer-accent-text hover:text-composer-text"
              >
                <IconArrowBackUp className="size-[13px]" />
                Pull from ( )
              </button>
            )}
            <BackgroundTextInput
              initialText={line.backgroundText ?? ""}
              onCommit={(text) => onBackgroundChange(line.lineId, text)}
              onClose={close}
            />
          </div>
        )}
      </Popover>
    )}

    {line.hasTiming && <span className="text-[11.5px] text-composer-accent-text">synced</span>}
    {line.hasBrackets && <IconAlertTriangle className="size-[15px] text-composer-error" />}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { LinePreviewActions };
