import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { MenuItem } from "@/ui/menu";
import type { ContextMenuTargets } from "@/views/timeline/use-context-menu-targets";
import type { useWordMenuActions } from "@/views/timeline/use-word-menu-actions";

// -- Interfaces ----------------------------------------------------------------

interface WordEditMenuItemsProps {
  targets: ContextMenuTargets;
  actions: ReturnType<typeof useWordMenuActions>;
}

// -- Components ----------------------------------------------------------------

const WordEditMenuItems: React.FC<WordEditMenuItemsProps> = ({ targets, actions }) => {
  const { mergeInfo, snapNeededInfo, wordCommandTargets } = targets;
  const {
    handleEditWord,
    handleSplitSyllables,
    handleSplitWord,
    handleMergeWords,
    handleMergeSyllables,
    handleSnapSyllables,
  } = actions;
  return (
    <>
      {wordCommandTargets?.editable && (
        <>
          <MenuItem label="Edit text" shortcut={getEffectiveKeysArray("timeline.editWord")} onSelect={handleEditWord} />
          <MenuItem
            label="Split syllables"
            shortcut={getEffectiveKeysArray("timeline.splitSyllable")}
            onSelect={handleSplitSyllables}
          />
          <MenuItem
            label="Split word"
            shortcut={getEffectiveKeysArray("timeline.splitWord")}
            onSelect={handleSplitWord}
          />
        </>
      )}
      {mergeInfo && (
        <MenuItem
          label={mergeInfo.kind === "syllables" ? "Merge syllables" : "Merge words"}
          shortcut={getEffectiveKeysArray(
            mergeInfo.kind === "syllables" ? "timeline.mergeSyllablesIntoWord" : "timeline.mergeWords",
          )}
          onSelect={handleMergeWords}
        />
      )}
      {!mergeInfo && wordCommandTargets?.syllableMerge && (
        <MenuItem
          label="Merge syllables"
          shortcut={getEffectiveKeysArray("timeline.mergeSyllablesIntoWord")}
          onSelect={handleMergeSyllables}
        />
      )}
      {snapNeededInfo && <MenuItem label="Snap syllables flush" onSelect={handleSnapSyllables} />}
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordEditMenuItems };
