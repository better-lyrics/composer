import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { findIdenticalWords } from "@/utils/identical-word-matcher";
import { SplitModeContent } from "@/views/sync/split-mode-content";
import {
  type UseSyllableSplitterStateResult,
  useSyllableSplitterState,
} from "@/views/sync/use-syllable-splitter-state";
import { IconScissors } from "@tabler/icons-react";
import { useMemo, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyllableSplitterProps {
  lineId: string;
  type: "word" | "bg";
  word: WordTiming;
  wordIndex: number;
  onSplit: (wordIndex: number, newWords: WordTiming[]) => void;
}

interface SyllableSplitPanelProps extends Pick<SyllableSplitterProps, "lineId" | "type" | "word" | "wordIndex"> {
  state: UseSyllableSplitterStateResult;
  close: () => void;
}

// -- Components ---------------------------------------------------------------

const SyllableSplitPanel: React.FC<SyllableSplitPanelProps> = ({ lineId, type, word, wordIndex, state, close }) => {
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
    <div className="p-5">
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
  trigger: HTMLButtonElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SyllableSplitPopover: React.FC<SyllableSplitPopoverProps> = ({ trigger, open, onOpenChange, ...splitter }) => {
  const state = useSyllableSplitterState(splitter);
  const { lineId, type, word, wordIndex } = splitter;
  return (
    <Popover reference={trigger} open={open} onOpenChange={onOpenChange}>
      {(close) => (
        <SyllableSplitPanel lineId={lineId} type={type} word={word} wordIndex={wordIndex} state={state} close={close} />
      )}
    </Popover>
  );
};

// Every synced word has a splitter, so its popover mounts on the first open and stays mounted after.
const SyllableSplitter: React.FC<SyllableSplitterProps> = (props) => {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);

  if (props.word.text.trimEnd().length < 2) {
    return null;
  }

  const toggle = () => {
    setOpened(true);
    setOpen(!open);
  };

  return (
    <>
      <Button
        ref={setTrigger}
        size="sm"
        variant="ghost"
        title="Split into syllables"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="px-1.5 py-0.5 h-auto align-middle rounded-sm"
      >
        <IconScissors className="size-3" />
      </Button>
      {opened && <SyllableSplitPopover {...props} trigger={trigger} open={open} onOpenChange={setOpen} />}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyllableSplitter };
