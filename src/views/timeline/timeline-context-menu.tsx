import { useAudioStore } from "@/stores/audio";
import { getAgentColor, useProjectStore } from "@/stores/project";
import type { LyricLine, WordTiming } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { useSettingsStore } from "@/stores/settings";
import { formatKey } from "@/ui/help-modal";
import { isMac } from "@/utils/platform";
import { convertLineToWord } from "@/utils/sync-helpers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getEffectiveLines, isLineSynced } from "@/views/timeline/utils";
import { IconCommand } from "@tabler/icons-react";
import { FloatingPortal } from "@floating-ui/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const setLinesWithHistory = useProjectStore((s) => s.setLinesWithHistory);
  const duration = useAudioStore((s) => s.duration);

  const lines = useMemo(() => getEffectiveLines(rawLines), [rawLines]);

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
    const { lineId, time } = contextMenu.target;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const newWord: WordTiming = {
      text: "...",
      begin: Math.max(0, time - wordDuration / 2),
      end: Math.min(duration, time + wordDuration / 2),
    };

    const words = [...(line.words ?? []), newWord].sort((a, b) => a.begin - b.begin);
    const newIndex = words.indexOf(newWord);

    for (let i = 0; i < words.length; i++) {
      const isLast = i === words.length - 1;
      const hasSpace = words[i].text.endsWith(" ");
      if (!isLast && !hasSpace) {
        words[i] = { ...words[i], text: `${words[i].text} ` };
      } else if (isLast && hasSpace) {
        words[i] = { ...words[i], text: words[i].text.trimEnd() };
      }
    }

    updateLineWithHistory(lineId, { words });
    useTimelineStore.getState().setEditingWord({ lineId, wordIndex: newIndex, type: "word" });
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
            <MenuItem label="Delete line" onClick={handleDeleteLine} danger />
          </>
        )}
      </div>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelineContextMenu };
