import { useProjectStore } from "@/stores/project";
import { stripSplitCharacter } from "@/utils/split-character";
import { generateForLine } from "@/utils/romanization/generate-for-line";
import { ROMANIZATION_LOG_PREFIX } from "@/utils/romanization/log-prefix";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { IconRefresh } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";

// -- Module-scope refs --------------------------------------------------------

const focusAndSelectOnMount = (el: HTMLInputElement | null) => {
  if (!el) return;
  el.focus();
  el.select();
};

// -- Interfaces ---------------------------------------------------------------

interface WordBlockRomanizationPopoverProps {
  lineId: string;
  wordIndex: number;
  scheme: string;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PanelProps {
  lineId: string;
  wordIndex: number;
  scheme: string;
  close: () => void;
}

// -- Components ---------------------------------------------------------------

const Panel: React.FC<PanelProps> = ({ lineId, wordIndex, scheme, close }) => {
  const line = useProjectStore((s) => s.lines.find((l) => l.id === lineId));
  const sourceWord = line?.words?.[wordIndex]?.text ?? "";
  const sourceDisplay = stripSplitCharacter(sourceWord);
  const initial = line?.romanization?.wordTexts?.[wordIndex] ?? "";
  const [input, setInput] = useState(initial);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const commit = useCallback(
    (next: string) => {
      const current = useProjectStore.getState().lines.find((l) => l.id === lineId);
      if (!current?.romanization?.wordTexts) return;
      const existing = current.romanization.wordTexts[wordIndex] ?? "";
      if (existing === next) return;
      const nextWordTexts = current.romanization.wordTexts.slice();
      nextWordTexts[wordIndex] = next;
      useProjectStore.getState().setLineRomanizationWithHistory(lineId, {
        ...current.romanization,
        wordTexts: nextWordTexts,
      });
    },
    [lineId, wordIndex],
  );

  const handleRegenerate = useCallback(async () => {
    const current = useProjectStore.getState().lines.find((l) => l.id === lineId);
    if (!current?.words) return;
    const word = current.words[wordIndex];
    if (!word) return;
    setIsRegenerating(true);
    try {
      const slice = {
        ...current,
        text: stripSplitCharacter(word.text),
        words: [word],
        romanization: undefined,
      };
      const data = await generateForLine(slice, scheme);
      const next = (data.wordTexts?.[0] ?? data.text).trim();
      if (!next) {
        close();
        return;
      }
      setInput(next);
      commit(next);
      close();
    } catch (err) {
      console.error(`${ROMANIZATION_LOG_PREFIX} Per-word regenerate failed`, err);
    } finally {
      setIsRegenerating(false);
    }
  }, [lineId, wordIndex, scheme, commit, close]);

  return (
    <div className="p-2 w-64">
      <p className="mb-1 text-xs text-composer-text-secondary select-none">Per-word romanization</p>
      <p className="mb-2 text-xs text-composer-text-muted select-text truncate" title={sourceDisplay}>
        {sourceDisplay}
      </p>
      <input
        ref={focusAndSelectOnMount}
        type="text"
        aria-label="Per-word romanization text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => commit(input)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit(input);
            close();
          }
          if (e.key === "Escape") {
            close();
          }
        }}
        placeholder={sourceDisplay}
        className="w-full px-2 py-1 text-sm border rounded bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1 px-1.5 h-6 text-xs rounded cursor-pointer bg-composer-button hover:bg-composer-button-hover text-composer-text-muted hover:text-composer-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconRefresh className="size-3" />
          {isRegenerating ? "Regenerating" : "Regenerate"}
        </button>
      </div>
    </div>
  );
};

const WordBlockRomanizationPopover: React.FC<WordBlockRomanizationPopoverProps> = ({
  lineId,
  wordIndex,
  scheme,
  anchorEl,
  isOpen,
  onClose,
}) => {
  const elements = useMemo(() => ({ reference: anchorEl }), [anchorEl]);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement: "bottom-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!isOpen || !anchorEl) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className="z-100 border select-none shadow-2xl rounded-xl bg-composer-bg border-composer-border"
        >
          <Panel lineId={lineId} wordIndex={wordIndex} scheme={scheme} close={onClose} />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { WordBlockRomanizationPopover };
export type { WordBlockRomanizationPopoverProps };
