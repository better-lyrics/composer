import { useUIStore } from "@/stores/ui";
import { INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";
import { IconSearch, IconX } from "@tabler/icons-react";

// -- Component -----------------------------------------------------------------

const SettingsSearchInput: React.FC<{ inputRef: React.RefObject<HTMLInputElement | null> }> = ({ inputRef }) => {
  const query = useUIStore((s) => s.settingsQuery);
  const setQuery = useUIStore((s) => s.setSettingsQuery);

  return (
    <div className="relative mb-1.5">
      <IconSearch
        size={14}
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-composer-text-muted pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        aria-label="Search settings"
        placeholder="Search settings"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={cn(INPUT_STYLES, "w-full h-8 pl-8 pr-8 text-[13px] select-text")}
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center size-5 rounded-md text-composer-text-muted hover:text-composer-text hover:bg-composer-button cursor-pointer transition-colors"
        >
          <IconX size={12} />
        </button>
      ) : (
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 rounded bg-composer-button font-mono text-[10px] text-composer-text-muted pointer-events-none">
          /
        </kbd>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SettingsSearchInput };
