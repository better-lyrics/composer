import { getAgentColor } from "@/domain/agent/colors";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import { LinePreviewActions } from "@/views/edit/line-preview-actions";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconLink } from "@tabler/icons-react";
import { useCallback } from "react";

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

const LINE_COLUMN = "line-cell flex justify-center w-11 shrink-0 font-mono font-medium";
const ROW_BODY = "flex flex-1 min-w-0 items-center gap-2 pl-3 pr-2 border-b border-(--divider) bg-clip-padding";

// -- Helpers ------------------------------------------------------------------

function rowBodyTone(isSelected: boolean, hasBrackets: boolean, inGroup: boolean): string {
  if (isSelected) return "bg-composer-accent/15";
  if (hasBrackets) return "bg-composer-warning/8";
  return inGroup ? "bg-[color-mix(in_oklab,var(--group)_4%,transparent)]" : "group-hover:bg-(--layer-1)";
}

// -- Components ---------------------------------------------------------------

const PreviewGroupHeader: React.FC<{ label: string; ordinal: number; total: number; color: string }> = ({
  label,
  ordinal,
  total,
  color,
}) => (
  <div className="flex h-[26px] select-none" style={{ "--group": color }} aria-hidden>
    <span className="grid place-items-center w-11 shrink-0 bg-[color-mix(in_oklab,var(--group)_10%,var(--gutter-bg))] shadow-[inset_-2px_0_0_color-mix(in_oklab,var(--group)_45%,var(--gutter-bg)),inset_0_-1px_0_var(--divider)]">
      <IconLink className="size-[13px] text-(--group)" />
    </span>
    <span
      className={cn(
        ROW_BODY,
        "gap-1.5 text-[11.5px] text-(--muted) bg-[color-mix(in_oklab,var(--group)_9%,transparent)]",
      )}
    >
      <b className="min-w-0 truncate font-semibold text-(--group)">{label}</b>
      <span className="shrink-0 tabular-nums">
        ・ {ordinal} of {total}
      </span>
    </span>
  </div>
);

const EmptyLinePreview: React.FC<{
  lineNumber: number;
  columnStyle: React.CSSProperties;
  onGutterMouseEnter: LinePreviewProps["onGutterMouseEnter"];
}> = ({ lineNumber, columnStyle, onGutterMouseEnter }) => (
  <div className="flex items-stretch min-h-7 opacity-60">
    <span
      className={cn(LINE_COLUMN, "items-center text-[11px] tabular-nums text-(--muted) select-none")}
      style={columnStyle}
      onMouseEnter={(e) => onGutterMouseEnter(lineNumber, e)}
    >
      {lineNumber}
    </span>
    <span className={cn(ROW_BODY, "text-[13px] italic text-(--muted)")}>(empty line)</span>
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
  const columnStyle = { "--agent": agentColor };

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
      <EmptyLinePreview
        lineNumber={line.lineNumber}
        columnStyle={columnStyle}
        onGutterMouseEnter={onGutterMouseEnter}
      />
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
      {/* react-doctor-disable-next-line react-doctor/html-no-nested-interactive -- the gutter is its own click and drag-select target inside the row; splitting them breaks gutter drag-select */}
      <span
        // react-doctor-disable-next-line react-doctor/prefer-tag-over-role, react-doctor/role-button-requires-complete-keyboard-activation -- never in tab order; a <button> would nest in the row's button role, and Space must stay play/pause after a click focuses the row
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

      <div className={cn(ROW_BODY, rowBodyTone(isSelected, line.hasBrackets, groupColor !== undefined))}>
        <span
          data-testid="line-preview-text"
          className={cn(
            "text-sm truncate",
            line.hasBrackets
              ? "text-[color-mix(in_oklab,var(--color-composer-warning)_70%,var(--ink))]"
              : "text-composer-text",
          )}
        >
          {stripSplitCharacter(line.text)}
        </span>

        {line.backgroundText && (
          <span
            data-testid="line-preview-background"
            className="min-w-0 truncate pr-0.5 text-[12.5px] italic text-(--muted)"
          >
            {line.backgroundText}
          </span>
        )}

        <LinePreviewActions
          line={line}
          agents={agents}
          agentColor={agentColor}
          editsSelection={isSelected && hasMultipleSelected}
          onAgentChange={onAgentChange}
          onBulkAgentChange={onBulkAgentChange}
          onBackgroundChange={onBackgroundChange}
          onExtractLine={onExtractLine}
        />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LinePreview, PreviewGroupHeader };
