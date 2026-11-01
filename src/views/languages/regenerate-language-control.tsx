import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { Popover } from "@/ui/popover";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { IconCheck, IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LanguageGenerationSelection {
  transliteration: boolean;
  translations: string[];
}

interface RegenerateLanguageControlProps {
  isGenerating: boolean;
  hasGenerated: boolean;
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
  <label className="flex items-center gap-2 w-full h-[34px] px-2 rounded-lg text-[13px] text-(--label) cursor-pointer transition-colors hover:bg-(--layer-1) hover:text-composer-text has-[:focus-visible]:bg-(--layer-1) has-[:focus-visible]:text-composer-text">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
    <span className="flex-1">{label}</span>
    <IconCheck
      aria-hidden="true"
      className={cn("size-[15px] text-composer-accent-text shrink-0", !checked && "invisible")}
    />
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
    <div className="w-62 p-1.5 select-none">
      <p className="px-2 pt-1.5 pb-1 text-xs text-(--muted) text-pretty">
        Only checked tracks get replaced. Your other edits stay.
      </p>
      <CheckRow label="Transliteration" checked={includeTransliteration} onChange={setIncludeTransliteration} />
      {translations.length > 0 && <div className="h-px mx-1.5 my-1 bg-(--divider)" />}
      {translations.map((language) => (
        <CheckRow
          key={language}
          label={languageNames.get(language) ?? language}
          checked={selectedTranslations.has(language)}
          onChange={(checked) => toggleTranslation(language, checked)}
        />
      ))}
      <div className="mt-1 px-0.5 pt-1.5 shadow-[inset_0_1px_0_var(--divider)]">
        <Button
          variant="primary"
          hasIcon
          disabled={selectedCount === 0}
          className="w-full h-[30px]"
          onClick={() =>
            onRegenerate({
              transliteration: includeTransliteration,
              translations: translations.filter((language) => selectedTranslations.has(language)),
            })
          }
        >
          <IconRefresh className="size-4" />
          Regenerate {pluralize(selectedCount, "track")}
        </Button>
      </div>
    </div>
  );
};

const RegenerateLanguageControl: React.FC<RegenerateLanguageControlProps> = ({
  isGenerating,
  hasGenerated,
  translations,
  languageNames,
  onRegenerateAll,
  onRegenerateSelection,
}) => (
  <div className="flex items-center">
    <Button
      hasIcon
      size="lg"
      variant="primary"
      disabled={isGenerating}
      onClick={onRegenerateAll}
      className="rounded-r-none"
    >
      <IconRefresh className={cn("size-4", isGenerating && "animate-spin")} />
      {isGenerating ? "Generating…" : hasGenerated ? "Regenerate all" : "Generate all"}
    </Button>
    <Popover
      placement="bottom-end"
      trigger={
        <IconButton
          label="Choose what to regenerate"
          icon={<IconChevronDown className="size-4" />}
          variant="primary"
          disabled={isGenerating}
          className="h-9 w-8 rounded-l-none rounded-r-xl shadow-[inset_1px_0_0_rgb(255_255_255/0.22)]"
        />
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
