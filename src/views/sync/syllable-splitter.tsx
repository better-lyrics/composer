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

const SyllableSplitter: React.FC<SyllableSplitterProps> = ({ lineId, type, word, wordIndex, onSplit }) => {
  const state = useSyllableSplitterState({ lineId, type, word, wordIndex, onSplit });

  if (word.text.trimEnd().length < 2) {
    return null;
  }

  return (
    <Popover
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
      {(close) => (
        <SyllableSplitPanel lineId={lineId} type={type} word={word} wordIndex={wordIndex} state={state} close={close} />
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyllableSplitter };
