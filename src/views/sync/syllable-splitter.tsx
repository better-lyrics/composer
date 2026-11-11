import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { LazyPopover } from "@/ui/lazy-popover";
import { Popover } from "@/ui/popover";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { SplitModeContent } from "@/views/sync/split-mode-content";
import {
  type UseSyllableSplitterStateResult,
  useSyllableSplitterState,
} from "@/views/sync/use-syllable-splitter-state";
import { IconScissors } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyllableSplitterProps {
  lineId: string;
  type: "word" | "bg";
  word: WordTiming;
  wordIndex: number;
  onSplit: (wordIndex: number, newWords: WordTiming[]) => void;
}

interface SyllableSplitPanelProps extends Pick<SyllableSplitterProps, "lineId" | "type" | "word" | "wordIndex"> {
  panelId: string;
  state: UseSyllableSplitterStateResult;
  close: () => void;
}

// -- Components ---------------------------------------------------------------

const SyllableSplitPanel: React.FC<SyllableSplitPanelProps> = ({
  panelId,
  lineId,
  type,
  word,
  wordIndex,
  state,
  close,
}) => {
  const { splitPoints, caseInsensitive } = state;
  const lines = useProjectStore((s) => s.lines);
  const identicalCount = useMemo(
    () =>
      findIdenticalWords(lines, { lineId, wordIndex, type }, { caseInsensitive, excludeSource: true, splitPoints })
        .length,
    [lines, lineId, wordIndex, type, caseInsensitive, splitPoints],
  );
  const text = word.text.trimEnd();

  return (
    <div id={panelId} className="p-5">
      <h3 className="mb-4 text-lg font-medium">Split "{text}"</h3>
      <SplitModeContent
        text={text}
        splitPoints={splitPoints}
        onToggleSplit={state.toggleSplit}
        onConfirm={() => state.confirmSplit(close, identicalCount)}
        onCancel={() => state.cancelSplit(close)}
        applyToAll={state.applyToAll}
        onApplyToAllChange={state.setApplyToAll}
        caseInsensitive={caseInsensitive}
        onCaseInsensitiveChange={state.setCaseInsensitive}
        identicalCount={identicalCount}
        sourceText={text}
        showApplyControls={!word.transliteration}
        secondaryText={word.transliteration?.trim()}
        secondarySplitPoints={state.transliterationSplitPoints}
        onToggleSecondarySplit={state.toggleTransliterationSplit}
      />
    </div>
  );
};

interface SyllableSplitPopoverProps extends SyllableSplitterProps {
  panelId: string;
  trigger: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SyllableSplitPopover: React.FC<SyllableSplitPopoverProps> = ({
  panelId,
  trigger,
  open,
  onOpenChange,
  ...splitter
}) => {
  const state = useSyllableSplitterState(splitter);
  const { lineId, type, word, wordIndex } = splitter;
  return (
    <Popover reference={trigger} open={open} onOpenChange={onOpenChange}>
      {(close) => (
        <SyllableSplitPanel
          panelId={panelId}
          lineId={lineId}
          type={type}
          word={word}
          wordIndex={wordIndex}
          state={state}
          close={close}
        />
      )}
    </Popover>
  );
};

// Every synced word has a splitter, so its popover mounts on the first open and stays mounted after.
const SyllableSplitter: React.FC<SyllableSplitterProps> = (props) => {
  if (props.word.text.trimEnd().length < 2) {
    return null;
  }

  return (
    <LazyPopover
      hasPopup="dialog"
      trigger={
        <Button
          size="sm"
          variant="ghost"
          title="Split into syllables"
          className="px-1.5 py-0.5 h-auto align-middle rounded-sm"
        >
          <IconScissors className="size-3" />
        </Button>
      }
    >
      {(anchor) => (
        <SyllableSplitPopover
          {...props}
          panelId={anchor.id}
          trigger={anchor.reference}
          open={anchor.open}
          onOpenChange={anchor.onOpenChange}
        />
      )}
    </LazyPopover>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyllableSplitter };
