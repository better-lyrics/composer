import { deriveTheme } from "@/domain/theme/derive";
import type { Theme } from "@/domain/theme/model";
import { cn } from "@/utils/cn";
import { IconMoonStars, IconPencil, IconSun, IconTrash } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetCardProps {
  theme: Theme;
  active: boolean;
  onSelect: (id: string) => void;
  custom?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// -- Styles --------------------------------------------------------------------

const CARD_BASE =
  "relative flex flex-col items-start text-left rounded-xl border px-2 pt-2.5 pb-3 cursor-pointer transition-colors select-none";

const CARD_INACTIVE = "border-composer-border hover:border-composer-border-hover hover:bg-composer-button/40";

const CARD_ACTIVE = "border-composer-accent ring-2 ring-composer-accent";

// Neutral chip in both schemes (composer-button is fg-at-10%, so it stays
// visible on a light card too). The sun/moon icon carries the scheme meaning.
const TAG_CHIP =
  "inline-flex items-center justify-center rounded-[5px] px-1 py-0.5 bg-composer-button text-composer-text-muted";

const ACTION_CLUSTER =
  "absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

const ACTION_BUTTON =
  "flex size-6 items-center justify-center rounded-md bg-composer-bg-elevated text-composer-text-muted shadow-sm cursor-pointer select-none hover:text-composer-text";

// -- Components ----------------------------------------------------------------

const ThemePresetCard: React.FC<ThemePresetCardProps> = ({
  theme,
  active,
  onSelect,
  custom = false,
  onEdit,
  onDelete,
}) => {
  const resolved = deriveTheme(theme);
  const chips = [
    resolved.bg,
    resolved["bg-elevated"],
    resolved.accent,
    resolved["accent-warm"],
    resolved.text,
    resolved.error,
  ];
  const isLight = theme.scheme === "light";
  const description = custom ? `Custom · ${theme.desc ?? "Your saved theme."}` : (theme.desc ?? "Your saved theme.");
  const showActions = custom && Boolean(onEdit || onDelete);

  return (
    <div className="group relative flex">
      <button
        type="button"
        onClick={() => onSelect(theme.id)}
        className={cn(CARD_BASE, "flex-1", active ? CARD_ACTIVE : CARD_INACTIVE)}
      >
        <span
          data-theme-pill
          data-light={isLight}
          className={cn(
            "mb-2.5 inline-flex overflow-hidden rounded-[7px] border",
            isLight ? "border-black/25" : "border-white/[0.18]",
          )}
        >
          {chips.map((chip, index) => (
            <span
              key={`${theme.id}-chip-${index}`}
              data-theme-chip
              className="size-6 shrink-0"
              style={{ backgroundColor: chip }}
            />
          ))}
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-composer-text">
          {theme.name}
          <span
            className={TAG_CHIP}
            aria-label={isLight ? "Light theme" : "Dark theme"}
            title={isLight ? "Light theme" : "Dark theme"}
          >
            {isLight ? <IconSun size={12} /> : <IconMoonStars size={12} />}
          </span>
        </span>
        <span className="mt-px block text-[11px] text-composer-text-muted">{description}</span>
      </button>
      {showActions && (
        <span className={ACTION_CLUSTER}>
          {onEdit && (
            <button
              type="button"
              className={ACTION_BUTTON}
              aria-label={`Edit ${theme.name}`}
              title="Edit theme"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(theme.id);
              }}
            >
              <IconPencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={ACTION_BUTTON}
              aria-label={`Delete ${theme.name}`}
              title="Delete theme"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(theme.id);
              }}
            >
              <IconTrash size={13} />
            </button>
          )}
        </span>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePresetCard };
