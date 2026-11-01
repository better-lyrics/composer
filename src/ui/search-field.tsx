import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";
import { IconSearch, IconX } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// -- Component -----------------------------------------------------------------

const SearchField: React.FC<SearchFieldProps> = ({ label, value, onChange, inputRef }) => (
  <div className="relative shrink-0 mb-2">
    <IconSearch
      aria-hidden="true"
      className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-(--muted) pointer-events-none"
    />
    <input
      ref={inputRef}
      type="text"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
      spellCheck={false}
      className={cn(INPUT_STYLES, "w-full h-[34px] pl-[34px] pr-8 rounded-[10px] text-[13px] select-text")}
    />
    {value ? (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => {
          onChange("");
          inputRef.current?.focus();
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center size-5 rounded-md text-composer-text-muted hover:text-composer-text hover:bg-composer-button cursor-pointer transition-colors"
      >
        <IconX size={12} />
      </button>
    ) : (
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex text-(--muted) pointer-events-none *:ml-0">
        <InlineKeyBadge keys={["/"]} />
      </span>
    )}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SearchField };
