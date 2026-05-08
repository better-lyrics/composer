import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { getAgentColor, useProjectStore } from "@/stores/project";
import type { LyricLine, WordTiming } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { useSettingsStore } from "@/stores/settings";
import { formatKey } from "@/ui/help-modal";
import { GROUP_COLORS } from "@/utils/group-colors";
import { isMac } from "@/utils/platform";
import { convertLineToWord } from "@/utils/sync-helpers";
import { findInsertionSlot, normalizeTrailingSpaces } from "@/utils/word-spaces";
import { createGroupFromSelection, instanceToTemplate } from "@/views/timeline/group-ops";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getEffectiveLines, isLineSynced } from "@/views/timeline/utils";
import { IconCommand } from "@tabler/icons-react";
import { FloatingPortal } from "@floating-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
          {shortcut.map((key, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: key order is fixed
              key={`${key}-${i}`}
              className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-medium rounded bg-white/10 text-composer-text-muted leading-none shadow-[0_2px_0_0_rgba(0,0,0,0.3)]"
            >
              {key === "Mod" && isMac ? <IconCommand className="w-2.5 h-2.5" /> : formatKey(key)}
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

// -- Component ----------------------------------------------------------------

const TimelineContextMenu: React.FC = () => {
  const contextMenu = useTimelineStore((s) => s.contextMenu);
  const clearContextMenu = useTimelineStore((s) => s.clearContextMenu);
  const menuRef = useRef<HTMLDivElement>(null);

  const rawLines = useProjectStore((s) => s.lines);
  const agents = useProjectStore((s) => s.agents);
  const groups = useProjectStore((s) => s.groups);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const setLinesWithHistory = useProjectStore((s) => s.setLinesWithHistory);
  const duration = useAudioStore((s) => s.duration);
  const confirm = useConfirm();

  const lines = useMemo(() => getEffectiveLines(rawLines), [rawLines]);

  const renamingGroupId = useTimelineStore((s) => s.renamingGroupId);
  const setRenamingGroupId = useTimelineStore((s) => s.setRenamingGroupId);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (!renamingGroupId) return;
    const g = groups.find((gr) => gr.id === renamingGroupId);
    if (g) setRenameValue(g.label);
  }, [renamingGroupId, groups]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
  }, [contextMenu, clearContextMenu]);

  const handleEditWord = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId, wordIndex, type } = contextMenu.target;
    useTimelineStore.getState().setEditingWord({ lineId, wordIndex, type });
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleSplitSyllables = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId, wordIndex, type } = contextMenu.target;
    useTimelineStore.getState().setEditingWord(null);
    // Store target info and open syllable splitter via editingWord with a flag
    // For now, use the keyboard shortcut approach - set selection and close menu
    const lineIndex = contextMenu.target.lineIndex;
    useTimelineStore.getState().setSelectedWords([{ lineId, lineIndex, wordIndex, type }]);
    clearContextMenu();
    // Dispatch a custom event so the syllable splitter can pick it up
    window.dispatchEvent(new CustomEvent("timeline:split-syllable"));
  }, [contextMenu, clearContextMenu]);

  const handleDeleteWord = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId, wordIndex, type } = contextMenu.target;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const remaining = wordsArray.filter((_, i) => i !== wordIndex);
    if (type === "word") {
      updateLineWithHistory(lineId, { words: remaining });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: remaining.length > 0 ? remaining : undefined,
        backgroundText: remaining.length > 0 ? remaining.map((w) => w.text).join("") : undefined,
      });
    }
    clearContextMenu();
  }, [contextMenu, lines, updateLineWithHistory, clearContextMenu]);

  const handleAddWordHere = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "track") return;
    const { lineId, time, type } = contextMenu.target;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const existingWords = type === "word" ? line.words : line.backgroundWords;
    const slot = findInsertionSlot(existingWords ?? [], time, wordDuration, duration);
    if (!slot) {
      clearContextMenu();
      return;
    }

    const newWord: WordTiming = { text: "...", begin: slot.begin, end: slot.end };
    const sorted = [...(existingWords ?? []), newWord].sort((a, b) => a.begin - b.begin);
    const newIndex = sorted.indexOf(newWord);
    const words = normalizeTrailingSpaces(sorted);

    if (type === "word") {
      updateLineWithHistory(lineId, { words });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: words,
        backgroundText: words.map((w) => w.text).join(""),
      });
    }
    useTimelineStore.getState().setEditingWord({ lineId, wordIndex: newIndex, type });
    clearContextMenu();
  }, [contextMenu, lines, duration, updateLineWithHistory, clearContextMenu]);

  const handleAddLine = useCallback(
    (position: "above" | "below") => {
      if (!contextMenu || contextMenu.target.kind !== "gutter") return;
      const { lineIndex } = contextMenu.target;
      const defaultAgentId = agents[0]?.id ?? "v1";
      const newLine = {
        id: crypto.randomUUID(),
        text: "",
        agentId: defaultAgentId,
      };
      const newLines = [...lines];
      const insertIndex = position === "above" ? lineIndex : lineIndex + 1;
      newLines.splice(insertIndex, 0, newLine);
      setLinesWithHistory(newLines);
      clearContextMenu();
    },
    [contextMenu, lines, agents, setLinesWithHistory, clearContextMenu],
  );

  const handleDeleteLine = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return;
    const { lineIndex } = contextMenu.target;
    const newLines = lines.filter((_, i) => i !== lineIndex);
    setLinesWithHistory(newLines);
    clearContextMenu();
  }, [contextMenu, lines, setLinesWithHistory, clearContextMenu]);

  const gutterLineGroupInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return null;
    const { lineId } = contextMenu.target;
    const realLine = rawLines.find((l) => l.id === lineId);
    if (!realLine?.groupId) return null;
    return { lineId, groupId: realLine.groupId };
  }, [contextMenu, rawLines]);

  const handleDetachLine = useCallback(() => {
    if (!gutterLineGroupInfo) return;
    useProjectStore.getState().detachLine(gutterLineGroupInfo.lineId);
    toast.success("Line detached. Cmd+Z to undo.");
    clearContextMenu();
  }, [gutterLineGroupInfo, clearContextMenu]);

  const groupableSelection = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "gutter") return null;
    const selectedWords = useTimelineStore.getState().selectedWords;
    const selectedLineIds = new Set<string>(selectedWords.map((w) => w.lineId));
    if (!selectedLineIds.has(contextMenu.target.lineId)) {
      selectedLineIds.add(contextMenu.target.lineId);
    }
    if (selectedLineIds.size < 1) return null;
    const result = createGroupFromSelection(rawLines, selectedLineIds, useProjectStore.getState().groups);
    if (!result) return null;
    return { selectedLineIds, count: selectedLineIds.size, result };
  }, [contextMenu, rawLines]);

  const handleCreateGroupFromSelection = useCallback(() => {
    if (!groupableSelection) return;
    const projectState = useProjectStore.getState();
    projectState.setLinesWithHistory(groupableSelection.result.updatedLines);
    projectState.addGroup(groupableSelection.result.group);
    toast.success(`Grouped ${groupableSelection.count} line${groupableSelection.count === 1 ? "" : "s"}`);
    clearContextMenu();
  }, [groupableSelection, clearContextMenu]);

  const handleAssignAgent = useCallback(
    (agentId: string) => {
      if (!contextMenu || contextMenu.target.kind !== "gutter") return;
      const { lineId } = contextMenu.target;
      updateLineWithHistory(lineId, { agentId });
      clearContextMenu();
    },
    [contextMenu, updateLineWithHistory, clearContextMenu],
  );

  const selectedWords = useTimelineStore((s) => s.selectedWords);

  const handleSplitIntoWords = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return;
    const { lineId } = contextMenu.target;

    const selectedLineIds = new Set(selectedWords.map((w) => w.lineId));
    const targetIds = selectedLineIds.has(lineId) && selectedLineIds.size > 0 ? [...selectedLineIds] : [lineId];

    const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
    for (const id of targetIds) {
      const realLine = rawLines.find((l) => l.id === id);
      if (!realLine || !isLineSynced(realLine)) continue;
      const converted = convertLineToWord(realLine);
      if (converted.words) {
        updates.push({ id, updates: { words: converted.words, begin: undefined, end: undefined } });
      }
    }

    if (updates.length === 1) {
      updateLineWithHistory(updates[0].id, updates[0].updates);
    } else if (updates.length > 1) {
      useProjectStore.getState().updateLinesWithHistory(updates);
    }

    const newSelections: Array<{ lineId: string; lineIndex: number; wordIndex: number; type: "word" | "bg" }> = [];
    for (const u of updates) {
      const lineIndex = lines.findIndex((l) => l.id === u.id);
      if (lineIndex < 0 || !u.updates.words) continue;
      for (let wi = 0; wi < u.updates.words.length; wi++) {
        newSelections.push({ lineId: u.id, lineIndex, wordIndex: wi, type: "word" });
      }
    }
    if (newSelections.length > 0) {
      useTimelineStore.getState().setSelectedWords(newSelections);
    }

    clearContextMenu();
  }, [contextMenu, rawLines, selectedWords, lines, updateLineWithHistory, clearContextMenu]);

  const mergeInfo = useMemo(() => {
    if (selectedWords.length < 2) return null;
    const first = selectedWords[0];
    const allSameLine = selectedWords.every((w) => w.lineId === first.lineId && w.type === first.type);
    if (!allSameLine) return null;

    const sorted = [...selectedWords].sort((a, b) => a.wordIndex - b.wordIndex);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].wordIndex !== sorted[i - 1].wordIndex + 1) return null;
    }

    const line = lines.find((l) => l.id === first.lineId);
    if (!line) return null;
    const wordsArray = first.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return null;

    // Check no trailing spaces between merged words (except the last one)
    for (let i = 0; i < sorted.length - 1; i++) {
      const w = wordsArray[sorted[i].wordIndex];
      if (!w) return null;
      if (w.text.endsWith(" ")) return null;
    }

    return { sorted, lineId: first.lineId, type: first.type };
  }, [selectedWords, lines]);

  const handleMergeWords = useCallback(() => {
    if (!mergeInfo) return;
    const { sorted, lineId, type } = mergeInfo;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordsArray = type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const firstIdx = sorted[0].wordIndex;
    const lastIdx = sorted[sorted.length - 1].wordIndex;
    const mergedText = sorted.map((s) => wordsArray[s.wordIndex].text).join("");
    const merged: WordTiming = {
      text: mergedText,
      begin: wordsArray[firstIdx].begin,
      end: wordsArray[lastIdx].end,
    };

    const updatedWords = [...wordsArray.slice(0, firstIdx), merged, ...wordsArray.slice(lastIdx + 1)];

    if (type === "word") {
      updateLineWithHistory(lineId, {
        words: updatedWords,
        text: updatedWords
          .map((w) => w.text)
          .join("")
          .trimEnd(),
      });
    } else {
      updateLineWithHistory(lineId, {
        backgroundWords: updatedWords,
        backgroundText: updatedWords
          .map((w) => w.text)
          .join("")
          .trimEnd(),
      });
    }

    useTimelineStore.getState().clearSelection();
    clearContextMenu();
  }, [mergeInfo, lines, updateLineWithHistory, clearContextMenu]);

  const splitIntoWordsInfo = useMemo(() => {
    if (!contextMenu || contextMenu.target.kind !== "word") return null;
    const target = contextMenu.target;

    const selectedLineIds = new Set(selectedWords.map((w) => w.lineId));
    const targetIds =
      selectedLineIds.has(target.lineId) && selectedLineIds.size > 0 ? [...selectedLineIds] : [target.lineId];

    const lineSyncedIds = targetIds.filter((id) => {
      const realLine = rawLines.find((l) => l.id === id);
      return realLine && isLineSynced(realLine);
    });

    if (lineSyncedIds.length === 0) return null;
    return { count: lineSyncedIds.length };
  }, [contextMenu, selectedWords, rawLines]);

  const handleDetachInstance = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    useProjectStore.getState().removeInstance(groupId, instanceIdx);
    toast.success("Instance detached. Cmd+Z to undo.");
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleAddInstanceAtPlayhead = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    const audioEl = useAudioStore.getState().audioElement;
    const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
    const template = instanceToTemplate(useProjectStore.getState().lines, groupId, instanceIdx);
    if (template.length === 0) {
      toast.error("Could not derive instance template");
      return;
    }
    useProjectStore.getState().addInstance(groupId, template, playheadTime);
    toast.success("Linked instance added at playhead");
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleShiftToPlayhead = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId, instanceIdx } = contextMenu.target;
    const audioEl = useAudioStore.getState().audioElement;
    const playheadTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
    const projectLines = useProjectStore.getState().lines;
    let earliest = Number.POSITIVE_INFINITY;
    for (const line of projectLines) {
      if (line.groupId !== groupId || line.instanceIdx !== instanceIdx) continue;
      if (line.words?.length) {
        for (const w of line.words) if (w.begin < earliest) earliest = w.begin;
      }
      if (line.begin !== undefined && line.begin < earliest) earliest = line.begin;
    }
    if (!Number.isFinite(earliest)) return;
    const delta = playheadTime - earliest;
    useProjectStore.getState().shiftInstance(groupId, instanceIdx, delta);
    clearContextMenu();
  }, [contextMenu, clearContextMenu]);

  const handleDeleteGroup = useCallback(async () => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId } = contextMenu.target;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const projectLines = useProjectStore.getState().lines;
    const instanceCount = new Set(
      projectLines
        .filter((l) => l.groupId === groupId && l.instanceIdx !== undefined)
        .map((l) => l.instanceIdx as number),
    ).size;

    clearContextMenu();
    const ok = await confirm({
      title: `Delete the "${group.label}" group?`,
      description: `All ${instanceCount} instance${instanceCount === 1 ? "" : "s"} will become standalone lines. They keep their text and timing, but stop updating together.`,
      confirmLabel: "Delete group",
      variant: "destructive",
      settingsKey: "confirmGroupDissolution",
      recoverable: true,
    });
    if (!ok) return;
    useProjectStore.getState().removeGroup(groupId);
    toast.success("Group deleted");
  }, [contextMenu, groups, confirm, clearContextMenu]);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
    const { groupId } = contextMenu.target;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setRenamingGroupId(groupId);
    setRenameValue(group.label);
  }, [contextMenu, groups, setRenamingGroupId]);

  const handleRenameCommit = useCallback(() => {
    if (!renamingGroupId) return;
    const trimmed = renameValue.trim();
    if (trimmed.length > 0) {
      useProjectStore.getState().updateGroup(renamingGroupId, { label: trimmed });
    }
    setRenamingGroupId(null);
    setRenameValue("");
    clearContextMenu();
  }, [renamingGroupId, renameValue, clearContextMenu, setRenamingGroupId]);

  const handleRecolorGroup = useCallback(
    (color: string) => {
      if (!contextMenu || contextMenu.target.kind !== "group-banner") return;
      useProjectStore.getState().updateGroup(contextMenu.target.groupId, { color });
      clearContextMenu();
    },
    [contextMenu, clearContextMenu],
  );

  if (!contextMenu) return null;

  const { x, y, target } = contextMenu;

  return (
    <FloatingPortal>
      <div
        ref={menuRef}
        className="fixed z-100 min-w-36 p-1 border shadow-2xl rounded-lg bg-composer-bg border-composer-border select-none"
        style={{ left: x, top: y }}
      >
        {target.kind === "word" && (
          <>
            <MenuItem label="Edit text" shortcut={["E"]} onClick={handleEditWord} />
            <MenuItem label="Split syllables" shortcut={["S"]} onClick={handleSplitSyllables} />
            {mergeInfo && <MenuItem label="Merge words" shortcut={["M"]} onClick={handleMergeWords} />}
            {splitIntoWordsInfo && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    splitIntoWordsInfo.count > 1
                      ? `Split ${splitIntoWordsInfo.count} lines into words`
                      : "Split into words"
                  }
                  shortcut={getEffectiveKeysArray("timeline.splitIntoWords")}
                  onClick={handleSplitIntoWords}
                />
              </>
            )}
            <MenuDivider />
            <MenuItem label="Delete word" shortcut={["Del"]} onClick={handleDeleteWord} danger />
          </>
        )}

        {target.kind === "track" && (
          <MenuItem label="Add word here" shortcut={["Double Click"]} onClick={handleAddWordHere} />
        )}

        {target.kind === "gutter" && (
          <>
            <MenuItem label="Add line above" shortcut={["Shift", "N"]} onClick={() => handleAddLine("above")} />
            <MenuItem label="Add line below" shortcut={["N"]} onClick={() => handleAddLine("below")} />
            {groupableSelection && (
              <>
                <MenuDivider />
                <MenuItem
                  label={
                    groupableSelection.count > 1
                      ? `Group ${groupableSelection.count} selected lines`
                      : "Group this line"
                  }
                  shortcut={getEffectiveKeysArray("timeline.createGroup")}
                  onClick={handleCreateGroupFromSelection}
                />
              </>
            )}
            <MenuDivider />
            {agents.length > 1 && (
              <>
                <p className="px-3 py-1 text-xs text-composer-text-muted">Assign agent</p>
                <div className="flex flex-col gap-px">
                  {agents.map((agent) => {
                    const color = getAgentColor(agent.id);
                    const line = lines[target.lineIndex];
                    const isActive = line?.agentId === agent.id;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => handleAssignAgent(agent.id)}
                        className={`w-full text-left px-2 py-1 text-sm cursor-pointer rounded-md flex items-center gap-2 transition-colors ${
                          isActive
                            ? "bg-composer-accent/15 text-composer-text"
                            : "text-composer-text hover:bg-composer-button"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {agent.name || agent.id}
                      </button>
                    );
                  })}
                </div>
                <MenuDivider />
              </>
            )}
            {gutterLineGroupInfo && (
              <>
                <MenuItem label="Detach this line" onClick={handleDetachLine} />
                <MenuDivider />
              </>
            )}
            <MenuItem label="Delete line" onClick={handleDeleteLine} danger />
          </>
        )}

        {target.kind === "group-banner" &&
          (renamingGroupId === target.groupId ? (
            <input
              ref={(el) => el?.focus()}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCommit();
                if (e.key === "Escape") {
                  setRenamingGroupId(null);
                  setRenameValue("");
                }
                e.stopPropagation();
              }}
              onBlur={handleRenameCommit}
              className="w-full px-2 py-1 text-sm rounded border bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
            />
          ) : (
            <>
              <MenuItem label="Add instance at playhead" onClick={handleAddInstanceAtPlayhead} />
              <MenuItem label="Shift instance to playhead" onClick={handleShiftToPlayhead} />
              <MenuDivider />
              <MenuItem label="Rename" onClick={handleRenameStart} />
              <MenuDivider />
              <p className="px-3 pt-1.5 pb-1 text-xs text-composer-text-muted">Recolor</p>
              <div className="px-3 pb-1.5 grid grid-cols-5 gap-1.5">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => handleRecolorGroup(c)}
                    className="w-6 h-6 rounded-md cursor-pointer border border-white/10 hover:ring-2 hover:ring-white/40 transition-[box-shadow]"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <MenuDivider />
              <MenuItem label="Detach instance" onClick={handleDetachInstance} />
              <MenuItem label="Delete group" onClick={handleDeleteGroup} danger />
            </>
          ))}
      </div>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineContextMenu };
