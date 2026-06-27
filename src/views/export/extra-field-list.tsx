import { useReconciledBuffer } from "@/hooks/useReconciledBuffer";
import { Button } from "@/ui/button";
import { type Pair, pairsToRecord, reconcilePairs, sameRecord, seedPairs } from "@/views/export/extra-field-pairs";
import { INPUT_STYLES } from "@/views/export/metadata-field-list";
import { IconPlus, IconX } from "@tabler/icons-react";
import { nanoid } from "nanoid";

// -- Interfaces ---------------------------------------------------------------

interface ExtraFieldListProps {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

// -- Component ----------------------------------------------------------------

const ExtraFieldList: React.FC<ExtraFieldListProps> = ({ values, onChange }) => {
  // Pairs carry a stable id so reorders/removals keep input focus and identity.
  // The buffer re-seeds whenever extra is written from outside (load, import).
  const { rows: pairs, commit } = useReconciledBuffer<Pair, Record<string, string>>(values, onChange, {
    seed: seedPairs,
    reconcile: reconcilePairs,
    equal: sameRecord,
    emit: pairsToRecord,
  });

  const handleEdit = (id: string, patch: Partial<Pair>) =>
    commit(pairs.map((pair) => (pair.id === id ? { ...pair, ...patch } : pair)));
  const handleRemove = (id: string) => commit(pairs.filter((pair) => pair.id !== id));
  const handleAdd = () => commit([...pairs, { id: nanoid(), key: "", value: "" }]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-composer-text-secondary select-none">Extra fields</span>
      {pairs.map((pair, index) => (
        <div key={pair.id} className="flex items-center gap-2">
          <input
            type="text"
            aria-label={`Field ${index + 1} key`}
            value={pair.key}
            placeholder="Key"
            onChange={(e) => handleEdit(pair.id, { key: e.target.value })}
            className={INPUT_STYLES}
          />
          <input
            type="text"
            aria-label={`Field ${index + 1} value`}
            value={pair.value}
            placeholder="Value"
            onChange={(e) => handleEdit(pair.id, { value: e.target.value })}
            className={INPUT_STYLES}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove field ${index + 1}`}
            onClick={() => handleRemove(pair.id)}
          >
            <IconX className="size-4" />
          </Button>
        </div>
      ))}
      <Button hasIcon size="sm" variant="secondary" className="self-start" aria-label="Add field" onClick={handleAdd}>
        <IconPlus className="size-3.5" />
        Add field
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExtraFieldList };
