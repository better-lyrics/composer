import { Button } from "@/ui/button";
import { IconPlus, IconX } from "@tabler/icons-react";

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

// -- Component ----------------------------------------------------------------

const MetadataFieldList: React.FC<MetadataFieldListProps> = ({ label, itemNoun, values, placeholder, onChange }) => {
  const handleEdit = (index: number, value: string) => {
    const next = values.map((existing, i) => (i === index ? value : existing));
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([...values, ""]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-composer-text-secondary select-none">{label}</span>
      {values.map((value, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, identity follows index
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            aria-label={`${itemNoun} ${index + 1}`}
            value={value}
            placeholder={placeholder}
            onChange={(e) => handleEdit(index, e.target.value)}
            className={INPUT_STYLES}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${itemNoun.toLowerCase()} ${index + 1}`}
            onClick={() => handleRemove(index)}
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
