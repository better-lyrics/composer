import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

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

const RegenerateSelectionMenu: React.FC<RegenerateSelectionMenuProps> = ({
  translations,
  languageNames,
  onRegenerate,
}) => {
  const [includeTransliteration, setIncludeTransliteration] = useState(true);
  const [selectedTranslations, setSelectedTranslations] = useState(() => new Set(translations));
  const selectedCount = Number(includeTransliteration) + selectedTranslations.size;

  const toggleTranslation = (language: string) => {
    setSelectedTranslations((current) => {
      const next = new Set(current);
      if (next.has(language)) next.delete(language);
      else next.add(language);
      return next;
    });
  };

  return (
    <div className="w-72 p-2">
      <div className="px-2 pt-1 pb-2">
        <p className="text-sm font-medium text-composer-text">Choose what to regenerate</p>
        <p className="mt-0.5 text-xs leading-relaxed text-composer-text-muted">
          Only selected content will be replaced. Other edits stay untouched.
        </p>
      </div>

      <div className="flex flex-col gap-0.5">
        <label className="flex items-center gap-2.5 px-2 py-2 text-sm rounded-lg cursor-pointer text-composer-text hover:bg-composer-button">
          <input
            type="checkbox"
            checked={includeTransliteration}
            onChange={(event) => setIncludeTransliteration(event.target.checked)}
            className="size-4 accent-composer-accent"
          />
          <span className="flex-1">Transliteration</span>
        </label>

        {translations.length > 0 && (
          <>
            <div className="mx-2 my-1 border-t border-composer-border" />
            <p className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-wide uppercase text-composer-text-muted">
              Translations
            </p>
            {translations.map((language) => (
              <label
                key={language}
                className="flex items-center gap-2.5 px-2 py-2 text-sm rounded-lg cursor-pointer text-composer-text hover:bg-composer-button"
              >
                <input
                  type="checkbox"
                  checked={selectedTranslations.has(language)}
                  onChange={() => toggleTranslation(language)}
                  className="size-4 accent-composer-accent"
                />
                <span className="flex-1">{languageNames.get(language) ?? language}</span>
              </label>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-2 pt-2 mt-2 border-t border-composer-border">
        <span className="text-xs tabular-nums text-composer-text-muted">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </span>
        <Button
          size="sm"
          variant="primary"
          disabled={selectedCount === 0}
          onClick={() =>
            onRegenerate({
              transliteration: includeTransliteration,
              translations: translations.filter((language) => selectedTranslations.has(language)),
            })
          }
        >
          Regenerate selected
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
      <IconRefresh className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
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

export { RegenerateLanguageControl };
export type { LanguageGenerationSelection };
