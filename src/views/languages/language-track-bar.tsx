import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
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

const CHIP = "inline-flex shrink-0 items-center gap-1.5 h-7 pl-[9px] pr-1 text-[13px] rounded-lg text-(--label)";

// -- Component ----------------------------------------------------------------

const LanguageTrackBar: React.FC<LanguageTrackBarProps> = ({
  targets,
  languageNames,
  availableLanguages,
  disabled,
  onAdd,
  onRemove,
}) => (
  <div className="tray min-w-0 overflow-x-auto overscroll-none select-none">
    <span className={CHIP}>
      <IconAbc aria-hidden="true" className="size-3.5 text-(--muted)" />
      Transliteration
      <TransliterationHelp />
    </span>
    {targets.map((language) => {
      const name = languageNames.get(language) ?? language;
      return (
        <span key={language} className={CHIP}>
          {name}
          <IconButton
            label={`Remove ${name}`}
            icon={<IconX className="size-[13px]" />}
            variant="ghost"
            onClick={() => onRemove(language)}
            className="size-5 rounded-md hover:bg-(--layer-2) hover:text-composer-text"
          />
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
          <Button
            variant="ghost"
            size="sm"
            hasIcon
            disabled={disabled}
            className="shrink-0 h-7 gap-[5px] pl-[7px] pr-2.5 text-[13px] hover:bg-(--layer-2) hover:text-composer-text"
          >
            <IconPlus className="size-3.5" />
            Add language
          </Button>
        }
      />
    )}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { LanguageTrackBar };
