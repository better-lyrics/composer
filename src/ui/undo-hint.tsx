import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Constants ----------------------------------------------------------------

const UNDO_HINT_CLASS = "flex items-center gap-1.5 text-[12.5px] text-(--muted)";

// -- Components ---------------------------------------------------------------

const UndoHint: React.FC = () => {
  const undoKeys = getEffectiveKeysArray("global.undo");
  if (undoKeys.length === 0) return <div className={UNDO_HINT_CLASS}>This can be undone.</div>;
  return (
    <div className={UNDO_HINT_CLASS}>
      This can be undone with{" "}
      <span className="inline-flex items-center">
        <InlineKeyBadge keys={undoKeys} />.
      </span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { UndoHint };
