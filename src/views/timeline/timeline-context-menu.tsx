import { getAgentColor } from "@/domain/agent/colors";
import type { LyricLine } from "@/domain/line/model";
import { selectionBounds } from "@/domain/selection/bounds";
import { lineWordSelections } from "@/domain/selection/line-selections";
import type { WordSelection } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Menu, type MenuAnchor, MenuItem, MenuLabel, MenuRadioItem, MenuSeparator } from "@/ui/menu";
import { SingerTag } from "@/ui/singer-tag";
import { GROUP_COLORS } from "@/utils/group-colors";
import { pluralize } from "@/utils/pluralize";
import { CopyCutMenuItems, PasteHereMenuItem } from "@/views/timeline/clipboard-menu-items";
import {
  loopSelection,
  playSelection,
  selectLine,
  selectWordUnlessSelected,
} from "@/views/timeline/selection-playback";
import { type ContextMenuTarget, useTimelineStore } from "@/views/timeline/timeline-store";
import { type ContextMenuTargets, useContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import { useGroupMenuActions } from "@/views/timeline/use-group-menu-actions";
import { useInstanceMenuActions } from "@/views/timeline/use-instance-menu-actions";
import { useLineMenuActions } from "@/views/timeline/use-line-menu-actions";
import { useSharedTimingMenuActions } from "@/views/timeline/use-shared-timing-menu-actions";
import { useWordMenuActions } from "@/views/timeline/use-word-menu-actions";
import { useMemo } from "react";

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
      <MenuSeparator />
      {groupableSelection && (
        <MenuItem
          label={
            groupableSelection.count > 1
              ? `Group ${groupableSelection.count} lines${groupableSelection.addedFromGaps > 0 ? ` (incl. ${pluralize(groupableSelection.addedFromGaps, "gap")})` : ""}`
              : "Group this line"
          }
          shortcut={getEffectiveKeysArray("timeline.createGroup")}
          onSelect={onCreateGroup}
        />
      )}
      {soleOption && (
        <MenuItem label={`Conform to "${soleOption.group.label}"`} onSelect={() => onConform(soleOption.group.id)} />
      )}
      {conformableSelection && !soleOption && (
        <>
          <MenuLabel>Conform to group</MenuLabel>
          {conformableSelection.options.map(({ group }) => (
            <MenuItem
              key={group.id}
              lead={<span className="size-3 rounded-[4px] shrink-0" style={{ backgroundColor: group.color }} />}
              label={group.label}
              onSelect={() => onConform(group.id)}
            />
          ))}
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

function autoAlignLabel({ count, realign }: { count: number; realign: boolean }): string {
  const verb = realign ? "Re-align" : "Auto-align";
  return count > 1 ? `${verb} ${count} lines` : `${verb} words`;
}

function deleteWordLabel(selectionCount: number | null, isSyllable: boolean): string {
  if (selectionCount !== null && selectionCount > 1) return `Delete ${pluralize(selectionCount, "word")}`;
  return isSyllable ? "Delete syllable" : "Delete word";
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

function PlaybackMenuItems({
  lines,
  selections,
  noun,
  select,
  clearContextMenu,
}: {
  lines: readonly LyricLine[];
  selections: readonly WordSelection[];
  noun: string;
  select?: () => void;
  clearContextMenu: () => void;
}) {
  if (!selectionBounds(lines, selections)) return null;
  const selectAndRun = (start: () => boolean) => {
    select?.();
    start();
    clearContextMenu();
  };

  return (
    <>
      <MenuItem
        label={`Play ${noun}`}
        shortcut={getEffectiveKeysArray("timeline.playSelection")}
        onSelect={() => selectAndRun(playSelection)}
      />
      <MenuItem
        label={`Loop ${noun}`}
        shortcut={getEffectiveKeysArray("global.toggleLoop")}
        onSelect={() => selectAndRun(loopSelection)}
      />
      <MenuSeparator />
    </>
  );
}

type WordTarget = Extract<ContextMenuTarget, { kind: "word" }>;

function WordMenuSection({ targets, clearContextMenu, target }: SectionProps & { target: WordTarget }) {
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const {
    mergeInfo,
    groupedWordInfo,
    snapNeededInfo,
    splitIntoWordsInfo,
    autoAlignInfo,
    explicitToggleContext,
    clickedSelectionCount,
  } = targets;
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
  const { handleSplitIntoWords, handleAutoAlign } = useLineMenuActions(targets, clearContextMenu);
  const word: WordSelection = {
    lineId: target.lineId,
    lineIndex: target.lineIndex,
    wordIndex: target.wordIndex,
    type: target.type,
  };
  const playedWords = clickedSelectionCount === null ? [word] : selectedWords;
  const noun =
    clickedSelectionCount !== null && clickedSelectionCount > 1 ? pluralize(clickedSelectionCount, "word") : "word";

  return (
    <>
      <PlaybackMenuItems
        lines={targets.lines}
        selections={playedWords}
        noun={noun}
        select={() => selectWordUnlessSelected(word)}
        clearContextMenu={clearContextMenu}
      />
      <MenuItem label="Edit text" shortcut={getEffectiveKeysArray("timeline.editWord")} onSelect={handleEditWord} />
      <MenuItem
        label="Split syllables"
        shortcut={getEffectiveKeysArray("timeline.splitSyllable")}
        onSelect={handleSplitSyllables}
      />
      <MenuItem label="Split word" shortcut={getEffectiveKeysArray("timeline.splitWord")} onSelect={handleSplitWord} />
      {mergeInfo && (
        <MenuItem
          label="Merge words"
          shortcut={getEffectiveKeysArray("timeline.mergeWords")}
          onSelect={handleMergeWords}
        />
      )}
      {groupedWordInfo && (
        <MenuItem
          label="Merge syllables"
          shortcut={getEffectiveKeysArray("timeline.mergeSyllablesIntoWord")}
          onSelect={handleMergeSyllables}
        />
      )}
      {snapNeededInfo && <MenuItem label="Snap syllables flush" onSelect={handleSnapSyllables} />}
      {splitIntoWordsInfo && (
        <>
          <MenuSeparator />
          <MenuItem
            label={splitIntoWordsLabel(splitIntoWordsInfo.count)}
            shortcut={getEffectiveKeysArray("timeline.splitIntoWords")}
            onSelect={handleSplitIntoWords}
          />
        </>
      )}
      {autoAlignInfo && (
        <>
          {!splitIntoWordsInfo && <MenuSeparator />}
          <MenuItem label={autoAlignLabel(autoAlignInfo)} onSelect={handleAutoAlign} />
        </>
      )}
      <SelectionGrouping targets={targets} clearContextMenu={clearContextMenu} />
      {explicitToggleContext && (
        <>
          <MenuSeparator />
          <MenuItem
            label={explicitToggleLabel(explicitToggleContext)}
            shortcut={getEffectiveKeysArray("timeline.toggleExplicit")}
            onSelect={handleToggleExplicit}
          />
        </>
      )}
      <MenuSeparator />
      <CopyCutMenuItems lines={targets.lines} word={word} noun={noun} />
      <MenuSeparator />
      <MenuItem
        label={deleteWordLabel(clickedSelectionCount, groupedWordInfo !== null)}
        shortcut={clickedSelectionCount === null ? undefined : getEffectiveKeysArray("timeline.deleteSelection")}
        onSelect={handleDeleteWord}
        tone="danger"
      />
    </>
  );
}

type TrackTarget = Extract<ContextMenuTarget, { kind: "track" }>;

function TrackMenuSection({ targets, clearContextMenu, target }: SectionProps & { target: TrackTarget }) {
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const { handleAddWordHere } = useWordMenuActions(targets, clearContextMenu);
  const { handlePlaceLineHere, handlePlaceAtPlayhead } = useLineMenuActions(targets, clearContextMenu);

  return (
    <>
      <PlaybackMenuItems
        lines={targets.lines}
        selections={selectedWords}
        noun={pluralize(selectedWords.length, "word")}
        clearContextMenu={clearContextMenu}
      />
      <MenuItem label="Add word here" shortcut={["Double Click"]} onSelect={handleAddWordHere} />
      <PasteHereMenuItem time={target.time} lineIndex={target.lineIndex} />
      {targets.placeLineHereInfo && <MenuItem label="Place line here" onSelect={handlePlaceLineHere} />}
      {targets.placeAtPlayheadInfo && <MenuItem label="Place at playhead" onSelect={handlePlaceAtPlayhead} />}
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
      <MenuLabel>Assign agent</MenuLabel>
      {agents.map((agent) => (
        <MenuRadioItem
          key={agent.id}
          lead={<SingerTag color={getAgentColor(agent.id)}>{agent.name || agent.id}</SingerTag>}
          label={agent.name || agent.id}
          hideLabel
          checked={activeAgentId === agent.id}
          onSelect={() => handleAssignAgent(agent.id)}
        />
      ))}
      <MenuSeparator />
    </>
  );
}

type GutterTarget = Extract<ContextMenuTarget, { kind: "gutter" }>;

function GutterMenuSection({ targets, clearContextMenu, target }: SectionProps & { target: GutterTarget }) {
  const { handleAddLine, handleDeleteLine, handleDetachLine, handlePlaceAtPlayhead } = useLineMenuActions(
    targets,
    clearContextMenu,
  );
  const { lineId, lineIndex } = target;
  const line = targets.lines.find((candidate) => candidate.id === lineId);
  const lineSelections = line ? lineWordSelections(line, lineIndex) : [];

  return (
    <>
      <PlaybackMenuItems
        lines={targets.lines}
        selections={lineSelections}
        noun="line"
        select={() => selectLine(lineId, lineIndex)}
        clearContextMenu={clearContextMenu}
      />
      <MenuItem label="Add line above" shortcut={["Shift", "N"]} onSelect={() => handleAddLine("above")} />
      <MenuItem label="Add line below" shortcut={["N"]} onSelect={() => handleAddLine("below")} />
      {targets.placeAtPlayheadInfo && <MenuItem label="Place at playhead" onSelect={handlePlaceAtPlayhead} />}
      <SelectionGrouping targets={targets} clearContextMenu={clearContextMenu} />
      <MenuSeparator />
      <AgentAssignment targets={targets} clearContextMenu={clearContextMenu} lineIndex={lineIndex} />
      {targets.gutterLineGroupInfo && (
        <>
          <MenuItem label="Detach this line" onSelect={handleDetachLine} />
          <MenuSeparator />
        </>
      )}
      <MenuItem label="Delete line" onSelect={handleDeleteLine} tone="danger" />
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
  const { sharingLabel, handleSharingAction } = useSharedTimingMenuActions(
    target.groupId,
    target.instanceIdx,
    clearContextMenu,
  );
  const isCollapsed = useTimelineStore.getState().collapsedInstances[`${target.groupId}:${target.instanceIdx}`];
  const openGroup = useTimelineStore((s) => s.openGroup);
  const groupColor = useProjectStore((s) => s.groups.find((group) => group.id === target.groupId)?.color);

  return (
    <>
      <MenuItem
        label="Open group"
        shortcut={getEffectiveKeysArray("timeline.openGroup")}
        onSelect={() => openGroup(target.groupId, target.instanceIdx)}
      />
      <MenuItem
        label={isCollapsed ? "Expand instance" : "Collapse instance"}
        shortcut={getEffectiveKeysArray("timeline.toggleCollapseInstance")}
        onSelect={handleToggleCollapse}
      />
      <MenuItem
        label={target.source === "gutter" ? "Jump to group" : "Jump to start"}
        shortcut={getEffectiveKeysArray("timeline.jumpToInstanceStart")}
        onSelect={handleJumpToGroupFromBanner}
      />
      <MenuItem
        label="Ping siblings"
        shortcut={getEffectiveKeysArray("timeline.pingSiblings")}
        onSelect={handlePingSiblings}
      />
      <MenuSeparator />
      <MenuItem
        label="Add instance at playhead"
        shortcut={getEffectiveKeysArray("timeline.duplicateAsLinked")}
        onSelect={handleAddInstanceAtPlayhead}
      />
      <MenuItem
        label="Shift instance to playhead"
        shortcut={getEffectiveKeysArray("timeline.shiftInstanceToPlayhead")}
        onSelect={handleShiftToPlayhead}
      />
      <MenuItem
        label="Jump to previous instance"
        shortcut={getEffectiveKeysArray("timeline.jumpPrevInstance")}
        onSelect={handleJumpPrevInstance}
      />
      <MenuItem
        label="Jump to next instance"
        shortcut={getEffectiveKeysArray("timeline.jumpNextInstance")}
        onSelect={handleJumpNextInstance}
      />
      {sharingLabel && (
        <>
          <MenuSeparator />
          <MenuItem label={sharingLabel} onSelect={handleSharingAction} />
        </>
      )}
      <MenuSeparator />
      <MenuItem label="Rename" onSelect={handleRenameStart} />
      <div role="group" aria-label="Recolor" className="flex flex-wrap gap-1.5 px-2.5 pt-1 pb-2">
        {GROUP_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={c === groupColor}
            onClick={() => handleRecolorGroup(c)}
            className="size-[18px] rounded-full cursor-pointer shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)] hover:shadow-[0_0_0_2px_var(--pop),0_0_0_3.5px_var(--edge-strong)] aria-pressed:shadow-[0_0_0_2px_var(--pop),0_0_0_3.5px_var(--ink)]"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <MenuSeparator />
      <MenuItem
        label="Detach instance"
        shortcut={getEffectiveKeysArray("timeline.detachInstance")}
        onSelect={handleDetachInstance}
      />
      <MenuItem
        label="Delete group"
        shortcut={getEffectiveKeysArray("timeline.deleteGroup")}
        onSelect={handleDeleteGroup}
        tone="danger"
      />
    </>
  );
}

// -- Component ----------------------------------------------------------------

const TimelineContextMenu: React.FC = () => {
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const clearContextMenu = useTimelineStore((s) => s.clearContextMenu);
  const targets = useContextMenuTargets();
  const anchor = useMemo<MenuAnchor | null>(
    () => (contextMenu ? { kind: "point", x: contextMenu.x, y: contextMenu.y, within: document.body } : null),
    [contextMenu],
  );

  if (!contextMenu || !anchor) return null;

  const { target } = contextMenu;
  const section = { targets, clearContextMenu };

  return (
    <Menu
      instant
      anchor={anchor}
      onClose={clearContextMenu}
      aria-label="Timeline actions"
      className="w-max min-w-[232px]"
    >
      {target.kind === "word" && <WordMenuSection {...section} target={target} />}
      {target.kind === "track" && <TrackMenuSection {...section} target={target} />}
      {target.kind === "gutter" && <GutterMenuSection {...section} target={target} />}
      {target.kind === "group-banner" && <GroupBannerMenuSection {...section} target={target} />}
    </Menu>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineContextMenu };
