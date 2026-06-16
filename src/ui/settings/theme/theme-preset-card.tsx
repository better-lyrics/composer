import { deriveTheme } from "@/domain/theme/derive";
import type { Theme } from "@/domain/theme/model";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetCardProps {
  theme: Theme;
  active: boolean;
  onSelect: (id: string) => void;
  custom?: boolean;
}

// -- Styles --------------------------------------------------------------------

const CARD_BASE =
  "relative text-left rounded-xl border bg-composer-bg-elevated px-2.5 pt-2.5 pb-3 cursor-pointer transition-colors select-none";

const CARD_INACTIVE = "border-composer-border hover:border-composer-border-hover";

const CARD_ACTIVE = "border-composer-accent ring-2 ring-composer-accent";

const TAG_BASE = "font-mono text-[9px] tracking-wide rounded-[5px] px-1.5 py-px";

const TAG_DARK = "bg-composer-button text-composer-text-muted";

const TAG_LIGHT = "bg-white text-composer-bg-dark";

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
            className="size-6.5 shrink-0"
            style={{ backgroundColor: chip }}
          />
        ))}
      </span>
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-composer-text">
        {theme.name}
        <span className={cn(TAG_BASE, isLight ? TAG_LIGHT : TAG_DARK)}>{isLight ? "LIGHT" : "DARK"}</span>
      </span>
      <span className="mt-px block text-[11px] text-composer-text-muted">{description}</span>
    </button>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePresetCard };
