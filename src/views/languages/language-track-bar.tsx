import { Button } from "@/ui/button";
import { Select } from "@/ui/select";
import { TransliterationHelp } from "@/views/languages/transliteration-help";
import { IconAbc, IconPlus, IconX } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface LanguageTrackBarProps {
  targets: string[];
  languageNames: ReadonlyMap<string, string>;
  availableLanguages: ReadonlyArray<readonly [string, string]>;
  disabled: boolean;
  onAdd: (language: string) => void;
  onRemove: (language: string) => void;
}

// -- Constants ----------------------------------------------------------------

const CHIP =
  "inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 text-xs font-medium rounded-lg bg-composer-button text-composer-text";

// -- Component ----------------------------------------------------------------

const LanguageTrackBar: React.FC<LanguageTrackBarProps> = ({
  targets,
  languageNames,
  availableLanguages,
  disabled,
  onAdd,
  onRemove,
}) => (
  <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-composer-border select-none">
    <span className={CHIP}>
      <IconAbc aria-hidden="true" className="size-3.5 text-composer-text-muted" />
      Transliteration
      <TransliterationHelp />
    </span>
    {targets.map((language) => {
      const name = languageNames.get(language) ?? language;
      return (
        <span key={language} className={CHIP}>
          {name}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${name}`}
            onClick={() => onRemove(language)}
            className="size-5 rounded-md"
          >
            <IconX className="size-3.5" />
          </Button>
        </span>
      );
    })}
    {availableLanguages.length > 0 && (
      <Select
        aria-label="Add language"
        value=""
        onChange={onAdd}
        placement="bottom-start"
        options={availableLanguages.map(([value, label]) => ({ value, label }))}
        trigger={
          <Button variant="ghost" size="sm" hasIcon disabled={disabled}>
            <IconPlus className="size-4" />
            Add language
          </Button>
        }
      />
    )}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { LanguageTrackBar };
