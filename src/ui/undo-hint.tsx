import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Components ---------------------------------------------------------------

const UndoHint: React.FC = () => {
  const undoKeys = getEffectiveKeysArray("global.undo");
  if (undoKeys.length === 0) return <div className="text-xs text-composer-text-muted">This can be undone.</div>;
  return (
    <div className="text-xs text-composer-text-muted">
      This can be undone with <InlineKeyBadge keys={undoKeys} />.
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { UndoHint };
