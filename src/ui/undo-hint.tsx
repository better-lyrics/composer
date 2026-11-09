import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Constants ----------------------------------------------------------------

const UNDO_HINT_CLASS = "flex items-center gap-1.5 text-[12.5px] text-(--muted)";

// -- Components ---------------------------------------------------------------

// The undo keys inline in a sentence, or the word "Undo" when undo has no key.
const UndoKeys: React.FC<{ className?: string }> = ({ className }) => {
  useShortcutBindingsStore((state) => state.overrides["global.undo"] ?? state.preset);
  const undoKeys = getEffectiveKeysArray("global.undo");
  return undoKeys.length > 0 ? <InlineKeyBadge keys={undoKeys} className={className} /> : <>Undo</>;
};

const UndoHint: React.FC = () => {
  const undoKeys = getEffectiveKeysArray("global.undo");
  if (undoKeys.length === 0) return <div className={UNDO_HINT_CLASS}>This can be undone.</div>;
  return (
    <div className={UNDO_HINT_CLASS}>
      This can be undone with{" "}
      <span className="inline-flex items-center">
        <UndoKeys />.
      </span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { UndoHint, UndoKeys };
