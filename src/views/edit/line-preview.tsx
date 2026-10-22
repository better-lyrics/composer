import { getAgentColor } from "@/domain/agent/colors";
import { INPUT_STYLES } from "@/ui/input-styles";
import { lineColumnRail, lineColumnTint } from "@/ui/line-column";
import { Popover } from "@/ui/popover";
import { Select } from "@/ui/select";
import { classifyLine } from "@/utils/background-vocal-extraction";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconAlertTriangle, IconChevronDown, IconLink, IconMicrophone } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LinePreviewProps {
  line: ParsedLine;
  agents: { id: string; name?: string }[];
  isSelected: boolean;
  hasMultipleSelected: boolean;
  groupColor?: string;
  groupTooltip?: string;
  onSelect: (lineNumber: number, shiftKey: boolean) => void;
  onAgentChange: (lineId: string, agentId: string) => void;
  onBulkAgentChange: (agentId: string) => void;
  onBackgroundChange: (lineId: string, text: string) => void;
  onExtractLine: (lineId: string) => void;
  onGutterMouseDown: (lineNumber: number, e: React.MouseEvent) => void;
  onGutterMouseEnter: (lineNumber: number, e: React.MouseEvent) => void;
  didDragRef: React.MutableRefObject<boolean>;
}

// -- Constants ----------------------------------------------------------------

const LINE_COLUMN = "flex justify-center w-11 shrink-0 border-r-2 shadow-[inset_0_-1px_0_var(--divider)]";
const ROW_BODY = "flex flex-1 min-w-0 items-center gap-2 pl-3 pr-2 border-b border-(--divider) bg-clip-padding";

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
      className={cn(INPUT_STYLES, "w-full")}
    />
  );
};

const PreviewGroupHeader: React.FC<{ label: string; ordinal: number; total: number; color: string }> = ({
  label,
  ordinal,
  total,
  color,
}) => (
  <div className="flex h-[26px] select-none" style={{ "--group": color }} aria-hidden>
    <span className="grid place-items-center w-11 shrink-0 border-r-2 border-[color-mix(in_oklab,var(--group)_45%,var(--gutter-bg))] bg-[color-mix(in_oklab,var(--group)_10%,var(--gutter-bg))] shadow-[inset_0_-1px_0_var(--divider)]">
      <IconLink className="size-[13px] text-(--group)" />
    </span>
    <span
      className={cn(
        ROW_BODY,
        "gap-1.5 text-[11.5px] text-(--muted) bg-[color-mix(in_oklab,var(--group)_9%,transparent)]",
      )}
    >
      <b className="font-semibold text-(--group)">{label}</b>
      <span className="tabular-nums">
        · {ordinal} of {total}
      </span>
    </span>
  </div>
);

const LinePreview: React.FC<LinePreviewProps> = ({
  line,
  agents,
  isSelected,
  hasMultipleSelected,
  groupColor,
  groupTooltip,
  onSelect,
  onAgentChange,
  onBulkAgentChange,
  onBackgroundChange,
  onExtractLine,
  onGutterMouseDown,
  onGutterMouseEnter,
  didDragRef,
}) => {
  const agentColor = getAgentColor(line.agentId);
  const columnStyle = { background: lineColumnTint(agentColor), borderRightColor: lineColumnRail(agentColor, false) };

  const selectLineForBulkEdit = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("select, button")) return;
      if (e.shiftKey) window.getSelection()?.removeAllRanges();
      onSelect(line.lineNumber, e.shiftKey);
    },
    [line.lineNumber, onSelect],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    if ((e.target as HTMLElement).closest("select, button")) return;
    e.preventDefault();
  }, []);

  const handleGutterClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDragRef.current) {
        didDragRef.current = false;
        e.stopPropagation();
      }
    },
    [didDragRef],
  );

  if (line.isEmpty) {
    return (
      <div className="flex items-stretch min-h-7 opacity-60">
        <span
          className={cn(LINE_COLUMN, "items-center text-[11px] tabular-nums text-(--muted) select-none")}
          style={columnStyle}
          onMouseEnter={(e) => onGutterMouseEnter(line.lineNumber, e)}
        >
          {line.lineNumber}
        </span>
        <span className={cn(ROW_BODY, "text-[13px] italic text-(--muted)")}>(empty line)</span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      className="group flex items-stretch min-h-7 cursor-pointer"
      style={groupColor ? { "--group": groupColor } : undefined}
      onMouseDown={handleMouseDown}
      onClick={selectLineForBulkEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(line.lineNumber, e.shiftKey);
      }}
      title={groupTooltip}
    >
      <span
        role="button"
        tabIndex={-1}
        className={cn(
          LINE_COLUMN,
          "items-center text-[11px] tabular-nums select-none cursor-pointer",
          isSelected ? "font-semibold text-composer-text" : "text-(--muted)",
        )}
        style={columnStyle}
        onMouseDown={(e) => onGutterMouseDown(line.lineNumber, e)}
        onMouseEnter={(e) => onGutterMouseEnter(line.lineNumber, e)}
        onClick={handleGutterClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleGutterClick(e as unknown as React.MouseEvent);
        }}
      >
        {line.lineNumber}
      </span>

      <div
        className={cn(
          ROW_BODY,
          isSelected
            ? "bg-composer-accent/15"
            : line.hasBrackets
              ? "bg-composer-error/8"
              : cn(groupColor && "bg-[color-mix(in_oklab,var(--group)_4%,transparent)]", "group-hover:bg-(--layer-1)"),
        )}
      >
        <span
          data-testid="line-preview-text"
          className={cn(
            "text-sm truncate",
            line.hasBrackets
              ? "text-[color-mix(in_oklab,var(--color-composer-error)_70%,var(--ink))]"
              : "text-composer-text",
          )}
        >
          {stripSplitCharacter(line.text)}
        </span>

        {line.backgroundText && (
          <span data-testid="line-preview-background" className="text-[12.5px] italic whitespace-nowrap text-(--muted)">
            {line.backgroundText}
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto transition-opacity opacity-0 group-hover:opacity-100">
          {agents.length > 1 && line.lineId && (
            <Select
              aria-label="Line agent"
              value={line.agentId}
              onChange={(next) => {
                if (isSelected && hasMultipleSelected) {
                  onBulkAgentChange(next);
                } else {
                  onAgentChange(line.lineId, next);
                }
              }}
              options={agents.map((agent) => ({ value: agent.id, label: agent.name || agent.id }))}
              trigger={
                <button
                  type="button"
                  aria-label="Line agent"
                  className="singer-tag cursor-pointer"
                  style={{ "--agent": agentColor }}
                >
                  {agents.find((agent) => agent.id === line.agentId)?.name || line.agentId}
                  <IconChevronDown className="size-3.5 -mt-0.5 -mr-1 opacity-60" />
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
                <div className="flex flex-col gap-2 w-56 p-2">
                  <p className="text-xs text-(--muted)">Background vocals</p>
                  {classifyLine(line.text).kind === "inline" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (line.lineId) onExtractLine(line.lineId);
                        close();
                      }}
                      className="flex w-full items-center gap-1 text-xs cursor-pointer text-composer-accent-text hover:text-composer-text"
                    >
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
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LinePreview, PreviewGroupHeader };
