import { clearBackground, setBackgroundText } from "@/domain/commands/word-structure";
import { useProjectStore } from "@/stores/project";
import { focusOnMount } from "@/utils/focus-on-mount";
import { useCallback, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface BackgroundTextEditorProps {
  lineId: string;
  backgroundText?: string;
}

// -- Helpers -------------------------------------------------------------------

// -- Components ----------------------------------------------------------------

const BackgroundTextEditor: React.FC<BackgroundTextEditorProps> = ({ lineId, backgroundText }) => {
  const [value, setValue] = useState(() => backgroundText ?? "");
  const [isEditing, setIsEditing] = useState(false);

  const handleCommit = useCallback(() => {
    const trimmed = value.trim() || undefined;
    const { commit } = useProjectStore.getState();
    commit(trimmed ? setBackgroundText(lineId, trimmed) : clearBackground(lineId));
    setIsEditing(false);
  }, [lineId, value]);

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
