import { useProjectStore } from "@/stores/project";
import { getAgentColor } from "@/domain/agent/colors";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { GROUP_COLORS } from "@/utils/group-colors";
import { formatKey } from "@/utils/format-key";
import { isMac } from "@/utils/platform";
import { type ContextMenuTargets, useContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import { useGroupMenuActions } from "@/views/timeline/use-group-menu-actions";
import { useInstanceMenuActions } from "@/views/timeline/use-instance-menu-actions";
import { useLineMenuActions } from "@/views/timeline/use-line-menu-actions";
import { type ContextMenuState, type ContextMenuTarget, useTimelineStore } from "@/views/timeline/timeline-store";
import { useWordMenuActions } from "@/views/timeline/use-word-menu-actions";
import { IconCommand } from "@tabler/icons-react";
import { flip, FloatingPortal, shift, size, useFloating } from "@floating-ui/react";
import { useEffect, useLayoutEffect } from "react";
import { pluralize } from "@/utils/pluralize";

function MenuItem({
  label,
  onClick,
  danger,
  shortcut,
}: { label: string; onClick: () => void; danger?: boolean; shortcut?: string[] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-4 px-3 py-1.5 text-sm cursor-pointer rounded-md transition-colors ${
        danger ? "text-composer-error hover:bg-composer-error/10" : "text-composer-text hover:bg-composer-button"
      }`}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="inline-flex items-center gap-0.5">
          {shortcut.map((key) => (
            <span
              key={key}
              className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-medium rounded bg-white/10 text-composer-text-muted leading-none shadow-[0_2px_0_0_rgba(0,0,0,0.3)]"
            >
              {key === "Mod" && isMac ? <IconCommand className="size-2.5" /> : formatKey(key)}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-composer-border" />;
}

// -- Grouping section ---------------------------------------------------------

function GroupingMenuSection({
  groupableSelection,
  conformableSelection,
  onCreateGroup,
  onConform,
}: {
  groupableSelection: ContextMenuTargets["groupableSelection"];
  conformableSelection: ContextMenuTargets["conformableSelection"];
  onCreateGroup: () => void;
  onConform: (groupId: string) => void;
}) {
  if (!groupableSelection && !conformableSelection) return null;
  const soleOption = conformableSelection?.options.length === 1 ? conformableSelection.options[0] : null;

  return (
    <>
      <MenuDivider />
      {groupableSelection && (
        <MenuItem
          label={
            groupableSelection.count > 1
              ? `Group ${groupableSelection.count} lines${groupableSelection.addedFromGaps > 0 ? ` (incl. ${pluralize(groupableSelection.addedFromGaps, "gap")})` : ""}`
              : "Group this line"
          }
          shortcut={getEffectiveKeysArray("timeline.createGroup")}
          onClick={onCreateGroup}
        />
      )}
      {soleOption && (
        <MenuItem label={`Conform to "${soleOption.group.label}"`} onClick={() => onConform(soleOption.group.id)} />
      )}
      {conformableSelection && !soleOption && (
        <>
          <p className="px-3 py-1 text-xs text-composer-text-muted">Conform to group</p>
          <div className="flex flex-col gap-px">
            {conformableSelection.options.map(({ group }) => (
              <button
                key={group.id}
                type="button"
                onClick={() => onConform(group.id)}
                className="w-full text-left py-1 pl-2 pr-2.5 text-sm cursor-pointer rounded-md flex items-center gap-2 text-composer-text hover:bg-composer-button transition-colors"
              >
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                {group.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// -- Labels -------------------------------------------------------------------

type ExplicitToggleContext = NonNullable<ContextMenuTargets["explicitToggleContext"]>;

function explicitToggleLabel({ allMarked, indices }: ExplicitToggleContext): string {
  if (indices.length > 1) return `${allMarked ? "Unmark" : "Mark"} ${indices.length} as explicit`;
  return allMarked ? "Unmark explicit" : "Mark as explicit";
}

function splitIntoWordsLabel(count: number): string {
  return count > 1 ? `Split ${count} lines into words` : "Split into words";
}

// -- Positioning --------------------------------------------------------------

function useContextMenuFloating(contextMenu: ContextMenuState | null, clearContextMenu: () => void) {
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    middleware: [
      flip({ fallbackPlacements: ["top-start", "bottom-end", "top-end"] }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
  });

  useLayoutEffect(() => {
    if (!contextMenu) return;
    const { x, y } = contextMenu;
    refs.setPositionReference({
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
      }),
    });
  }, [contextMenu, refs]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      const el = refs.floating.current;
      if (el && !el.contains(e.target as Node)) {
        clearContextMenu();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearContextMenu();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu, clearContextMenu, refs.floating]);

  return { refs, floatingStyles };
}

// -- Sections -----------------------------------------------------------------

interface SectionProps {
  targets: ContextMenuTargets;
  clearContextMenu: () => void;
}

function SelectionGrouping({ targets, clearContextMenu }: SectionProps) {
  const { handleCreateGroupFromSelection, handleConformToGroup } = useGroupMenuActions(targets, clearContextMenu);
  return (
    <GroupingMenuSection
      groupableSelection={targets.groupableSelection}
      conformableSelection={targets.conformableSelection}
      onCreateGroup={handleCreateGroupFromSelection}
      onConform={handleConformToGroup}
    />
  );
}

function WordMenuSection({ targets, clearContextMenu }: SectionProps) {
  const { mergeInfo, groupedWordInfo, snapNeededInfo, splitIntoWordsInfo, explicitToggleContext } = targets;
  const {
    handleEditWord,
    handleSplitSyllables,
    handleSplitWord,
    handleToggleExplicit,
    handleDeleteWord,
    handleMergeSyllables,
    handleSnapSyllables,
    handleMergeWords,
  } = useWordMenuActions(targets, clearContextMenu);
  const { handleSplitIntoWords } = useLineMenuActions(targets, clearContextMenu);

  return (
    <>
      <MenuItem label="Edit text" shortcut={getEffectiveKeysArray("timeline.editWord")} onClick={handleEditWord} />
      <MenuItem
        label="Split syllables"
        shortcut={getEffectiveKeysArray("timeline.splitSyllable")}
        onClick={handleSplitSyllables}
      />
      <MenuItem label="Split word" shortcut={getEffectiveKeysArray("timeline.splitWord")} onClick={handleSplitWord} />
      {mergeInfo && (
        <MenuItem
          label="Merge words"
          shortcut={getEffectiveKeysArray("timeline.mergeWords")}
          onClick={handleMergeWords}
        />
      )}
      {groupedWordInfo && (
        <MenuItem
          label="Merge syllables"
          shortcut={getEffectiveKeysArray("timeline.mergeSyllablesIntoWord")}
          onClick={handleMergeSyllables}
        />
      )}
      {snapNeededInfo && <MenuItem label="Snap syllables flush" onClick={handleSnapSyllables} />}
      {splitIntoWordsInfo && (
        <>
          <MenuDivider />
          <MenuItem
            label={splitIntoWordsLabel(splitIntoWordsInfo.count)}
            shortcut={getEffectiveKeysArray("timeline.splitIntoWords")}
            onClick={handleSplitIntoWords}
          />
        </>
      )}
      <SelectionGrouping targets={targets} clearContextMenu={clearContextMenu} />
      {explicitToggleContext && (
        <>
          <MenuDivider />
          <MenuItem
            label={explicitToggleLabel(explicitToggleContext)}
            shortcut={getEffectiveKeysArray("timeline.toggleExplicit")}
            onClick={handleToggleExplicit}
          />
        </>
      )}
      <MenuDivider />
      <MenuItem
        label={groupedWordInfo ? "Delete syllable" : "Delete word"}
        shortcut={["Del"]}
        onClick={handleDeleteWord}
        danger
      />
    </>
  );
}

function TrackMenuSection({ targets, clearContextMenu }: SectionProps) {
  const { handleAddWordHere } = useWordMenuActions(targets, clearContextMenu);
  const { handlePlaceLineHere } = useLineMenuActions(targets, clearContextMenu);

  return (
    <>
      <MenuItem label="Add word here" shortcut={["Double Click"]} onClick={handleAddWordHere} />
      {targets.placeLineHereInfo && <MenuItem label="Place line here" onClick={handlePlaceLineHere} />}
      <SelectionGrouping targets={targets} clearContextMenu={clearContextMenu} />
    </>
  );
}

function AgentAssignment({ targets, clearContextMenu, lineIndex }: SectionProps & { lineIndex: number }) {
  const agents = useProjectStore((s) => s.agents);
  const { handleAssignAgent } = useLineMenuActions(targets, clearContextMenu);
  if (agents.length <= 1) return null;
  const activeAgentId = targets.lines[lineIndex]?.agentId;

  return (
    <>
      <p className="px-3 py-1 text-xs text-composer-text-muted">Assign agent</p>
      <div className="flex flex-col gap-px">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => handleAssignAgent(agent.id)}
            className={`w-full text-left py-1 pl-2 pr-2.5 text-sm cursor-pointer rounded-md flex items-center gap-2 transition-colors ${
              activeAgentId === agent.id
                ? "bg-composer-accent/15 text-composer-text"
                : "text-composer-text hover:bg-composer-button"
            }`}
          >
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor(agent.id) }} />
            {agent.name || agent.id}
          </button>
        ))}
      </div>
      <MenuDivider />
    </>
  );
}

function GutterMenuSection({ targets, clearContextMenu, lineIndex }: SectionProps & { lineIndex: number }) {
  const { handleAddLine, handleDeleteLine, handleDetachLine } = useLineMenuActions(targets, clearContextMenu);

  return (
    <>
      <MenuItem label="Add line above" shortcut={["Shift", "N"]} onClick={() => handleAddLine("above")} />
      <MenuItem label="Add line below" shortcut={["N"]} onClick={() => handleAddLine("below")} />
      <SelectionGrouping targets={targets} clearContextMenu={clearContextMenu} />
      <MenuDivider />
      <AgentAssignment targets={targets} clearContextMenu={clearContextMenu} lineIndex={lineIndex} />
      {targets.gutterLineGroupInfo && (
        <>
          <MenuItem label="Detach this line" onClick={handleDetachLine} />
          <MenuDivider />
        </>
      )}
      <MenuItem label="Delete line" onClick={handleDeleteLine} danger />
    </>
  );
}

type GroupBannerTarget = Extract<ContextMenuTarget, { kind: "group-banner" }>;

function GroupBannerMenuSection({ targets, clearContextMenu, target }: SectionProps & { target: GroupBannerTarget }) {
  const { handleJumpToGroupFromBanner, handleDeleteGroup, handleRenameStart, handleRecolorGroup } = useGroupMenuActions(
    targets,
    clearContextMenu,
  );
  const {
    handleDetachInstance,
    handleToggleCollapse,
    handleAddInstanceAtPlayhead,
    handleShiftToPlayhead,
    handlePingSiblings,
    handleJumpPrevInstance,
    handleJumpNextInstance,
  } = useInstanceMenuActions(clearContextMenu);
  const isCollapsed = useTimelineStore.getState().collapsedInstances[`${target.groupId}:${target.instanceIdx}`];

  return (
    <>
      <MenuItem
        label={isCollapsed ? "Expand instance" : "Collapse instance"}
        shortcut={getEffectiveKeysArray("timeline.toggleCollapseInstance")}
        onClick={handleToggleCollapse}
      />
      <MenuItem
        label={target.source === "gutter" ? "Jump to group" : "Jump to start"}
        shortcut={getEffectiveKeysArray("timeline.jumpToInstanceStart")}
        onClick={handleJumpToGroupFromBanner}
      />
      <MenuItem
        label="Ping siblings"
        shortcut={getEffectiveKeysArray("timeline.pingSiblings")}
        onClick={handlePingSiblings}
      />
      <MenuDivider />
      <MenuItem
        label="Add instance at playhead"
        shortcut={getEffectiveKeysArray("timeline.duplicateAsLinked")}
        onClick={handleAddInstanceAtPlayhead}
      />
      <MenuItem
        label="Shift instance to playhead"
        shortcut={getEffectiveKeysArray("timeline.shiftInstanceToPlayhead")}
        onClick={handleShiftToPlayhead}
      />
      <MenuItem
        label="Jump to previous instance"
        shortcut={getEffectiveKeysArray("timeline.jumpPrevInstance")}
        onClick={handleJumpPrevInstance}
      />
      <MenuItem
        label="Jump to next instance"
        shortcut={getEffectiveKeysArray("timeline.jumpNextInstance")}
        onClick={handleJumpNextInstance}
      />
      <MenuDivider />
      <MenuItem label="Rename" shortcut={["Double Click"]} onClick={handleRenameStart} />
      <MenuDivider />
      <p className="px-3 pt-1.5 pb-1 text-xs text-composer-text-muted">Recolor</p>
      <div className="px-3 pb-1.5 grid grid-cols-5 gap-1.5">
        {GROUP_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => handleRecolorGroup(c)}
            className="size-6 rounded-md cursor-pointer border border-white/10 hover:ring-2 hover:ring-white/40 transition-[box-shadow]"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <MenuDivider />
      <MenuItem
        label="Detach instance"
        shortcut={getEffectiveKeysArray("timeline.detachInstance")}
        onClick={handleDetachInstance}
      />
      <MenuItem
        label="Delete group"
        shortcut={getEffectiveKeysArray("timeline.deleteGroup")}
        onClick={handleDeleteGroup}
        danger
      />
    </>
  );
}

// -- Component ----------------------------------------------------------------

const TimelineContextMenu: React.FC = () => {
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const clearContextMenu = useTimelineStore((s) => s.clearContextMenu);
  const { refs, floatingStyles } = useContextMenuFloating(contextMenu, clearContextMenu);
  const targets = useContextMenuTargets();

  if (!contextMenu) return null;

  const { target } = contextMenu;
  const section = { targets, clearContextMenu };

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        className="layer-floating min-w-36 p-1 border shadow-2xl rounded-lg bg-composer-bg border-composer-border select-none overflow-y-auto overscroll-contain"
        style={floatingStyles}
      >
        {target.kind === "word" && <WordMenuSection {...section} />}
        {target.kind === "track" && <TrackMenuSection {...section} />}
        {target.kind === "gutter" && <GutterMenuSection {...section} lineIndex={target.lineIndex} />}
        {target.kind === "group-banner" && <GroupBannerMenuSection {...section} target={target} />}
      </div>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineContextMenu };
