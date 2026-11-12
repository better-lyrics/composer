import { useReconciledBuffer } from "@/hooks/useReconciledBuffer";
import { Button } from "@/ui/button";
import { FieldError } from "@/ui/field-error";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import {
  duplicateKeyIds,
  isReservedExtraKey,
  type Pair,
  pairsToRecord,
  reconcilePairs,
  sameRecord,
  seedPairs,
} from "@/views/export/extra-field-pairs";
import { DETAILS_FIELD_STYLES, DETAILS_LABEL_STYLES } from "@/views/export/song-details-styles";
import { IconPlus, IconX } from "@tabler/icons-react";
import { nanoid } from "nanoid";
import { useId } from "react";

// -- Interfaces ---------------------------------------------------------------

interface ExtraFieldListProps {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

// -- Constants ----------------------------------------------------------------

const RESERVED_KEY_MESSAGE = "Reserved key ・ use the matching field above instead";
const DUPLICATE_KEY_MESSAGE = "Duplicate key ・ rename it or the first field with this key wins";

// -- Component ----------------------------------------------------------------

const ExtraFieldList: React.FC<ExtraFieldListProps> = ({ values, onChange }) => {
  const { rows: pairs, commit } = useReconciledBuffer<Pair, Record<string, string>>(values, onChange, {
    seed: seedPairs,
    reconcile: reconcilePairs,
    equal: sameRecord,
    emit: pairsToRecord,
  });

  const errorIdPrefix = useId();
  const duplicates = duplicateKeyIds(pairs);
  const keyErrorOf = (pair: Pair) =>
    isReservedExtraKey(pair.key) ? RESERVED_KEY_MESSAGE : duplicates.has(pair.id) ? DUPLICATE_KEY_MESSAGE : null;

  const handleEdit = (id: string, patch: Partial<Pair>) =>
    commit(pairs.map((pair) => (pair.id === id ? { ...pair, ...patch } : pair)));
  const handleRemove = (id: string) => commit(pairs.filter((pair) => pair.id !== id));
  const handleAdd = () => commit([...pairs, { id: nanoid(), key: "", value: "" }]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className={DETAILS_LABEL_STYLES}>Extra fields</span>
      {pairs.map((pair, index) => {
        const keyError = keyErrorOf(pair);
        const errorId = `${errorIdPrefix}-${pair.id}`;
        return (
          <div key={pair.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label={`Field ${index + 1} key`}
                aria-invalid={keyError !== null}
                aria-describedby={keyError === null ? undefined : errorId}
                value={pair.key}
                placeholder="Key"
                onChange={(e) => handleEdit(pair.id, { key: e.target.value })}
                className={cn("flex-1 min-w-0", DETAILS_FIELD_STYLES)}
              />
              <input
                type="text"
                aria-label={`Field ${index + 1} value`}
                value={pair.value}
                placeholder="Value"
                onChange={(e) => handleEdit(pair.id, { value: e.target.value })}
                className={cn("flex-1 min-w-0", DETAILS_FIELD_STYLES)}
              />
              <IconButton
                label={`Remove field ${index + 1}`}
                icon={<IconX className="size-[18px]" />}
                variant="ghost"
                className="hover:bg-(--layer-2) hover:text-composer-text"
                onClick={() => handleRemove(pair.id)}
              />
            </div>
            <FieldError id={errorId} message={keyError} />
          </div>
        );
      })}
      <Button
        hasIcon
        size="sm"
        variant="secondary"
        className="self-start pl-2.5 text-[13px]"
        aria-label="Add field"
        onClick={handleAdd}
      >
        <IconPlus className="size-4" />
        Add field
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExtraFieldList };
