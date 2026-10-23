import type { ReadableLine } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { MenuItem } from "@/ui/menu";
import { commitPasteAt } from "@/views/timeline/commit-paste";
import { selectWordUnlessSelected } from "@/views/timeline/selection-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineClipboard } from "@/views/timeline/use-timeline-clipboard";
import { toast } from "sonner";

// -- Interfaces ----------------------------------------------------------------

interface CopyCutMenuItemsProps {
  lines: readonly ReadableLine[];
  word: WordSelection;
  noun: string;
}

interface PasteHereMenuItemProps {
  time: number;
  lineIndex: number;
}

// -- Components ----------------------------------------------------------------

const CopyCutMenuItems: React.FC<CopyCutMenuItemsProps> = ({ lines, word, noun }) => {
  const { handleCopy, handleCut } = useTimelineClipboard(lines);
  const onSelectedWord = (action: () => void) => () => {
    selectWordUnlessSelected(word);
    action();
  };

  return (
    <>
      <MenuItem
        label={`Copy ${noun}`}
        shortcut={getEffectiveKeysArray("timeline.copy")}
        onSelect={onSelectedWord(handleCopy)}
      />
      <MenuItem
        label={`Cut ${noun}`}
        shortcut={getEffectiveKeysArray("timeline.cut")}
        onSelect={onSelectedWord(handleCut)}
      />
    </>
  );
};

const PasteHereMenuItem: React.FC<PasteHereMenuItemProps> = ({ time, lineIndex }) => {
  const clipboard = useTimelineStore((s) => s.clipboard);
  if (!clipboard || clipboard.entries.length === 0) return null;

  const pasteHere = async () => {
    const outcome = await commitPasteAt({ clipboard, cursorTime: time, lineIndex });
    if (outcome === "overlap") toast.error("Not enough room to paste here");
  };

  return <MenuItem label="Paste here" shortcut={getEffectiveKeysArray("timeline.paste")} onSelect={pasteHere} />;
};

// -- Exports -------------------------------------------------------------------

export { CopyCutMenuItems, PasteHereMenuItem };
