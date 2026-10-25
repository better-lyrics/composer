import type { Suggestion } from "@/domain/musicbrainz/suggestion";
import { useReconciledBuffer } from "@/hooks/useReconciledBuffer";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { DETAILS_FIELD_STYLES, DETAILS_LABEL_STYLES } from "@/views/export/song-details-styles";
import { cn } from "@/utils/cn";
import { type Row, reconcileRows, sameStrings, seedRows } from "@/views/export/metadata-field-rows";
import { SuggestedRow, SuggestionNote } from "@/views/export/musicbrainz/suggested-value";
import { IconPlus, IconX } from "@tabler/icons-react";
import { nanoid } from "nanoid";

// -- Interfaces ---------------------------------------------------------------

interface MetadataFieldListProps {
  label: string;
  itemNoun: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
  suggestion?: Suggestion<string[]>;
  onUseSuggestion?: (values: string[]) => void;
}

// -- Component ----------------------------------------------------------------

const MetadataFieldList: React.FC<MetadataFieldListProps> = ({
  label,
  itemNoun,
  values,
  placeholder,
  onChange,
  suggestion,
  onUseSuggestion,
}) => {
  const { rows, commit } = useReconciledBuffer<Row, string[]>(values, onChange, {
    seed: seedRows,
    reconcile: reconcileRows,
    equal: sameStrings,
    emit: (next) => next.map((row) => row.value),
  });

  const handleEdit = (id: string, value: string) =>
    commit(rows.map((row) => (row.id === id ? { ...row, value } : row)));
  const handleRemove = (id: string) => commit(rows.filter((row) => row.id !== id));
  const handleAdd = () => commit([...rows, { id: nanoid(), value: "" }]);
  const handleUseOne = (value: string) =>
    onUseSuggestion?.([...values.filter((existing) => existing.trim() !== ""), value]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className={DETAILS_LABEL_STYLES}>{label}</span>
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <input
            type="text"
            aria-label={`${itemNoun} ${index + 1}`}
            value={row.value}
            placeholder={placeholder}
            onChange={(e) => handleEdit(row.id, e.target.value)}
            className={cn("flex-1 min-w-0", DETAILS_FIELD_STYLES)}
          />
          <IconButton
            label={`Remove ${itemNoun.toLowerCase()} ${index + 1}`}
            icon={<IconX className="size-[18px]" />}
            variant="ghost"
            className="hover:bg-(--layer-2) hover:text-composer-text"
            onClick={() => handleRemove(row.id)}
          />
        </div>
      ))}
      {suggestion?.kind === "fill" &&
        suggestion.value.map((value, index) => (
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- the index only breaks ties between same-name people; the value is the identity
          <SuggestedRow key={`${index}-${value}`} value={value} fieldName={label} onUse={() => handleUseOne(value)} />
        ))}
      {suggestion?.kind === "differs" && (
        <SuggestionNote
          value={suggestion.value.join(", ")}
          fieldName={label}
          onUse={() => onUseSuggestion?.(suggestion.value)}
        />
      )}
      <Button
        hasIcon
        size="sm"
        variant="secondary"
        className="self-start pl-2.5 text-[13px]"
        aria-label={`Add ${itemNoun.toLowerCase()}`}
        onClick={handleAdd}
      >
        <IconPlus className="size-4" />
        Add {itemNoun.toLowerCase()}
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MetadataFieldList };
