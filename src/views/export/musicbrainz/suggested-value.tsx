import type { Suggestion } from "@/domain/musicbrainz/suggestion";
import { Button } from "@/ui/button";
import { DETAILS_FIELD_STYLES, DETAILS_LABEL_STYLES } from "@/views/export/song-details-styles";
import { cn } from "@/utils/cn";
import { IconArrowBackUp } from "@tabler/icons-react";
import { useId } from "react";

// -- Interfaces ---------------------------------------------------------------

interface UseSuggestionButtonProps {
  value: string;
  fieldName: string;
  onUse: () => void;
  className?: string;
}

interface SuggestionNoteProps {
  value: string;
  fieldName: string;
  onUse: () => void;
}

interface SuggestedFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fieldName: string;
  suggestion?: Suggestion<string>;
  onUseSuggestion: (value: string) => void;
  children?: React.ReactNode;
}

interface SuggestedRowProps {
  value: string;
  fieldName: string;
  onUse: () => void;
}

// -- Components ---------------------------------------------------------------

const UseSuggestionButton: React.FC<UseSuggestionButtonProps> = ({ value, fieldName, onUse, className }) => (
  <Button
    hasIcon
    variant="ghost"
    size="sm"
    aria-label={`Use ${value} for ${fieldName}`}
    onClick={onUse}
    className={cn(
      "h-5 shrink-0 gap-[3px] rounded-md pl-[5px] pr-[7px] text-[11.5px] text-composer-accent-text bg-composer-accent/14 hover:bg-composer-accent/24 hover:text-composer-accent-text",
      className,
    )}
  >
    <IconArrowBackUp className="size-[13px]" />
    Use
  </Button>
);

const SuggestionNote: React.FC<SuggestionNoteProps> = ({ value, fieldName, onUse }) => (
  <span className="flex items-center gap-1.5 text-xs text-composer-text-muted select-none">
    MusicBrainz has
    <span className="min-w-0 truncate text-composer-text-secondary select-text cursor-text">{value}</span>
    <UseSuggestionButton value={value} fieldName={fieldName} onUse={onUse} />
  </span>
);

const SuggestedField: React.FC<SuggestedFieldProps> = ({
  fieldName,
  suggestion,
  onUseSuggestion,
  placeholder,
  className,
  children,
  ...inputProps
}) => {
  const inputId = useId();
  const filling = suggestion?.kind === "fill";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={DETAILS_LABEL_STYLES}>
        {fieldName}
      </label>
      <span className="relative flex items-center gap-1.5">
        <input
          type="text"
          id={inputId}
          {...inputProps}
          placeholder={filling ? suggestion.value : placeholder}
          className={cn(
            "flex-1 min-w-0",
            DETAILS_FIELD_STYLES,
            filling && "pr-16 placeholder:text-composer-accent-text",
            className,
          )}
        />
        {filling && (
          <UseSuggestionButton
            value={suggestion.value}
            fieldName={fieldName}
            onUse={() => onUseSuggestion(suggestion.value)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          />
        )}
      </span>
      {suggestion?.kind === "differs" && (
        <SuggestionNote
          value={suggestion.value}
          fieldName={fieldName}
          onUse={() => onUseSuggestion(suggestion.value)}
        />
      )}
      {children}
    </div>
  );
};

const SuggestedRow: React.FC<SuggestedRowProps> = ({ value, fieldName, onUse }) => (
  <div className="flex items-center gap-1.5">
    <span
      className={cn(
        "flex flex-1 min-w-0 items-center gap-1.5",
        DETAILS_FIELD_STYLES,
        "pr-1.5 text-composer-accent-text",
      )}
    >
      <span className="min-w-0 flex-1 truncate select-text">{value}</span>
      <UseSuggestionButton value={value} fieldName={fieldName} onUse={onUse} />
    </span>
    <span aria-hidden="true" className="size-8 shrink-0" />
  </div>
);

// -- Exports ------------------------------------------------------------------

export { SuggestedField, SuggestedRow, SuggestionNote };
