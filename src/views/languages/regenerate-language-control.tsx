import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import { IconCheck, IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LanguageGenerationSelection {
  transliteration: boolean;
  translations: string[];
}

interface RegenerateLanguageControlProps {
  isGenerating: boolean;
  translations: string[];
  languageNames: ReadonlyMap<string, string>;
  onRegenerateAll: () => void;
  onRegenerateSelection: (selection: LanguageGenerationSelection) => void;
}

interface RegenerateSelectionMenuProps {
  translations: string[];
  languageNames: ReadonlyMap<string, string>;
  onRegenerate: (selection: LanguageGenerationSelection) => void;
}

// -- Components ---------------------------------------------------------------

const CheckRow: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-sm text-composer-text cursor-pointer transition-colors hover:bg-composer-button has-[:focus-visible]:bg-composer-button">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
    <span className="flex-1">{label}</span>
    <IconCheck aria-hidden="true" className={cn("size-3.5 text-composer-accent shrink-0", !checked && "invisible")} />
  </label>
);

const RegenerateSelectionMenu: React.FC<RegenerateSelectionMenuProps> = ({
  translations,
  languageNames,
  onRegenerate,
}) => {
  const [includeTransliteration, setIncludeTransliteration] = useState(true);
  const [selectedTranslations, setSelectedTranslations] = useState(() => new Set(translations));
  const selectedCount = Number(includeTransliteration) + selectedTranslations.size;

  const toggleTranslation = (language: string, checked: boolean) => {
    setSelectedTranslations((current) => {
      const next = new Set(current);
      if (checked) next.add(language);
      else next.delete(language);
      return next;
    });
  };

  return (
    <div className="w-64 p-1 select-none">
      <p className="px-2 pt-1.5 pb-1 text-xs text-composer-text-muted text-pretty">
        Only checked tracks get replaced. Your other edits stay.
      </p>
      <CheckRow label="Transliteration" checked={includeTransliteration} onChange={setIncludeTransliteration} />
      {translations.length > 0 && <div className="mx-2 my-1 border-t border-composer-border" />}
      {translations.map((language) => (
        <CheckRow
          key={language}
          label={languageNames.get(language) ?? language}
          checked={selectedTranslations.has(language)}
          onChange={(checked) => toggleTranslation(language, checked)}
        />
      ))}
      <div className="p-1 pt-2 mt-1 border-t border-composer-border">
        <Button
          size="sm"
          variant="primary"
          hasIcon
          disabled={selectedCount === 0}
          className="w-full"
          onClick={() =>
            onRegenerate({
              transliteration: includeTransliteration,
              translations: translations.filter((language) => selectedTranslations.has(language)),
            })
          }
        >
          <IconRefresh className="size-4" />
          Regenerate {selectedCount} {selectedCount === 1 ? "track" : "tracks"}
        </Button>
      </div>
    </div>
  );
};

const RegenerateLanguageControl: React.FC<RegenerateLanguageControlProps> = ({
  isGenerating,
  translations,
  languageNames,
  onRegenerateAll,
  onRegenerateSelection,
}) => (
  <div className="flex items-center">
    <Button hasIcon variant="primary" disabled={isGenerating} onClick={onRegenerateAll} className="rounded-r-none">
      <IconRefresh className={cn("size-4", isGenerating && "animate-spin")} />
      {isGenerating ? "Generating…" : "Regenerate all"}
    </Button>
    <Popover
      placement="bottom-end"
      trigger={
        <Button
          size="icon"
          variant="primary"
          disabled={isGenerating}
          aria-label="Choose what to regenerate"
          className="rounded-l-none border-l border-composer-on-accent/20"
        >
          <IconChevronDown className="size-4" />
        </Button>
      }
    >
      {(close) => (
        <RegenerateSelectionMenu
          translations={translations}
          languageNames={languageNames}
          onRegenerate={(selection) => {
            close();
            onRegenerateSelection(selection);
          }}
        />
      )}
    </Popover>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { RegenerateLanguageControl };
export type { LanguageGenerationSelection };
