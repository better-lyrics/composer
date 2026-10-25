import { deriveTheme } from "@/domain/theme/derive";
import type { Theme } from "@/domain/theme/model";
import { cn } from "@/utils/cn";
import { IconMoonStars, IconPencil, IconStar, IconStarFilled, IconSun, IconTrash } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetCardProps {
  theme: Theme;
  active: boolean;
  onSelect: (id: string) => void;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  custom?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// -- Styles --------------------------------------------------------------------

const CARD_BASE =
  "relative flex flex-col items-start text-left rounded-xl px-2.5 pt-2.5 pb-3 cursor-pointer transition-[background-color,box-shadow] select-none";

const CARD_INACTIVE = "bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] hover:bg-(--layer-2)";

const CARD_ACTIVE =
  "bg-[color-mix(in_oklab,var(--color-composer-accent)_10%,var(--layer-1))] shadow-[inset_0_0_0_1.5px_var(--color-composer-accent),0_0_0_3px_var(--lit-ring)]";

const CORNER_BUTTON =
  "grid size-6.5 place-items-center rounded-lg cursor-pointer select-none transition-[opacity,background-color,color]";

const ACTION_CLUSTER =
  "absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

const ACTION_BUTTON = cn(CORNER_BUTTON, "bg-(--cap) shadow-(--raised-edge) text-(--muted) hover:text-composer-text");

// -- Components ----------------------------------------------------------------

const FavoriteButton: React.FC<{ favorite: boolean; onToggle: () => void }> = ({ favorite, onToggle }) => (
  <button
    type="button"
    aria-pressed={favorite}
    aria-label={favorite ? "Remove from the theme menu" : "Add to the theme menu"}
    title="Show in the theme menu"
    onClick={onToggle}
    className={cn(
      CORNER_BUTTON,
      "absolute top-[39px] right-1.5 hover:bg-(--layer-2)",
      favorite
        ? "text-composer-warning"
        : "text-(--muted) opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-composer-text",
    )}
  >
    {favorite ? <IconStarFilled className="size-[15px]" /> : <IconStar className="size-[15px]" />}
  </button>
);

const CustomThemeActions: React.FC<{
  theme: Theme;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}> = ({ theme, onEdit, onDelete }) => (
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
        <IconPencil size={14} />
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
        <IconTrash size={14} />
      </button>
    )}
  </span>
);

const ThemePresetCard: React.FC<ThemePresetCardProps> = ({
  theme,
  active,
  onSelect,
  favorite,
  onToggleFavorite,
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
            "mb-2.5 inline-flex overflow-hidden rounded-[7px]",
            isLight ? "shadow-[0_0_0_1px_rgb(0_0_0/0.2)]" : "shadow-[0_0_0_1px_rgb(255_255_255/0.16)]",
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
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-composer-text">
          <span className="min-w-0 truncate" title={theme.name}>
            {theme.name}
          </span>
          <span
            className="px-1 py-0.5 opacity-60"
            aria-label={isLight ? "Light theme" : "Dark theme"}
            title={isLight ? "Light theme" : "Dark theme"}
          >
            {isLight ? <IconSun size={13} /> : <IconMoonStars size={13} />}
          </span>
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-(--muted) wrap-break-word">{description}</span>
      </button>
      <FavoriteButton favorite={favorite} onToggle={() => onToggleFavorite(theme.id)} />
      {showActions && <CustomThemeActions theme={theme} onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePresetCard };
