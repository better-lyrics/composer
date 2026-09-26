import { backgroundFields, CLEARED_BACKGROUND } from "@/domain/line/background";
import { useProjectStore } from "@/stores/project";
import { createBgWordsFromLine } from "@/utils/sync-helpers";
import { useCallback, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface BackgroundTextEditorProps {
  lineId: string;
  backgroundText?: string;
}

// -- Helpers -------------------------------------------------------------------

const focusOnMount = (el: HTMLInputElement | null) => el?.focus();

// -- Components ----------------------------------------------------------------

const BackgroundTextEditor: React.FC<BackgroundTextEditorProps> = ({ lineId, backgroundText }) => {
  const [value, setValue] = useState(() => backgroundText ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);

  const handleCommit = useCallback(() => {
    const trimmed = value.trim() || undefined;
    if (trimmed) {
      const line = useProjectStore.getState().lines.find((l) => l.id === lineId);
      const bgWords = line ? createBgWordsFromLine({ ...line, backgroundText: trimmed }) : null;
      updateLineWithHistory(lineId, backgroundFields({ text: trimmed, words: bgWords ?? undefined, source: "manual" }));
    } else {
      updateLineWithHistory(lineId, CLEARED_BACKGROUND);
    }
    setIsEditing(false);
  }, [lineId, value, updateLineWithHistory]);

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(backgroundText ?? "");
          setIsEditing(true);
        }}
        className="text-xs cursor-pointer text-composer-text-muted hover:text-composer-text px-1.5 py-0.5 rounded hover:bg-composer-button"
        title="Edit background vocals"
      >
        {backgroundText ? `BG: ${backgroundText}` : "Add BG"}
      </button>
    );
  }

  return (
    <input
      ref={focusOnMount}
      type="text"
      aria-label="Background vocals text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") handleCommit();
        if (e.key === "Escape") setIsEditing(false);
      }}
      placeholder="Background vocals"
      className="w-32 px-1.5 py-0.5 text-xs border rounded bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { BackgroundTextEditor };
