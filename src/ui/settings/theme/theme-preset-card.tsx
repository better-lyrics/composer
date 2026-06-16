import { deriveTheme } from "@/domain/theme/derive";
import type { Theme } from "@/domain/theme/model";
import { cn } from "@/utils/cn";
import { IconMoonStars, IconSun } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetCardProps {
  theme: Theme;
  active: boolean;
  onSelect: (id: string) => void;
  custom?: boolean;
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

// -- Components ----------------------------------------------------------------

const ThemePresetCard: React.FC<ThemePresetCardProps> = ({ theme, active, onSelect, custom = false }) => {
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

  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={cn(CARD_BASE, active ? CARD_ACTIVE : CARD_INACTIVE)}
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
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePresetCard };
