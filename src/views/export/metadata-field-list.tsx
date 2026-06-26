import { Button } from "@/ui/button";
import { IconPlus, IconX } from "@tabler/icons-react";
import { nanoid } from "nanoid";
import { useState } from "react";

// -- Constants ----------------------------------------------------------------

const INPUT_STYLES =
  "flex-1 px-2 py-1.5 text-sm rounded-md cursor-text bg-composer-input border border-composer-border text-composer-text focus:outline-none focus:border-composer-accent";

// -- Interfaces ---------------------------------------------------------------

interface MetadataFieldListProps {
  label: string;
  itemNoun: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}

interface Row {
  id: string;
  value: string;
}

// -- Component ----------------------------------------------------------------

const MetadataFieldList: React.FC<MetadataFieldListProps> = ({ label, itemNoun, values, placeholder, onChange }) => {
  // Rows carry a stable id so reorders/removals keep input focus and identity.
  // Seeded from the store on mount and re-seeded whenever the panel re-expands.
  const [rows, setRows] = useState<Row[]>(() => values.map((value) => ({ id: nanoid(), value })));

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(next.map((row) => row.value));
  };

  const handleEdit = (id: string, value: string) =>
    commit(rows.map((row) => (row.id === id ? { ...row, value } : row)));
  const handleRemove = (id: string) => commit(rows.filter((row) => row.id !== id));
  const handleAdd = () => commit([...rows, { id: nanoid(), value: "" }]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-composer-text-secondary select-none">{label}</span>
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-2">
          <input
            type="text"
            aria-label={`${itemNoun} ${index + 1}`}
            value={row.value}
            placeholder={placeholder}
            onChange={(e) => handleEdit(row.id, e.target.value)}
            className={INPUT_STYLES}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${itemNoun.toLowerCase()} ${index + 1}`}
            onClick={() => handleRemove(row.id)}
          >
            <IconX className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        hasIcon
        size="sm"
        variant="secondary"
        className="self-start"
        aria-label={`Add ${itemNoun.toLowerCase()}`}
        onClick={handleAdd}
      >
        <IconPlus className="size-3.5" />
        Add {itemNoun.toLowerCase()}
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MetadataFieldList, INPUT_STYLES };
