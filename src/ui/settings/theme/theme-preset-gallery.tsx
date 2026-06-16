import { useThemeStore } from "@/stores/theme";
import { PRESETS } from "@/domain/theme/presets";
import type { Theme } from "@/domain/theme/model";
import { Button } from "@/ui/button";
import { ThemePresetCard } from "@/ui/settings/theme/theme-preset-card";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetGalleryProps {
  onCustomize?: () => void;
}

interface ThemeGroupProps {
  label: string;
  themes: Theme[];
  activeThemeId: string;
  custom?: boolean;
}

// -- Constants -----------------------------------------------------------------

const GROUP_GRID = "grid grid-cols-3 gap-2.5";

const GROUP_LABEL = "font-mono text-[10.5px] tracking-wider text-composer-text-faint select-none";

const COMPOSER_PRESETS = PRESETS.filter((theme) => theme.group === "Composer");

const CLASSIC_PRESETS = PRESETS.filter((theme) => theme.group === "Classics");

// -- Components ----------------------------------------------------------------

const ThemeGroup: React.FC<ThemeGroupProps> = ({ label, themes, activeThemeId, custom = false }) => (
  <div className="flex flex-col gap-3">
    <span className={GROUP_LABEL}>{label}</span>
    <div className={GROUP_GRID}>
      {themes.map((theme) => (
        <ThemePresetCard
          key={theme.id}
          theme={theme}
          active={theme.id === activeThemeId}
          custom={custom}
          onSelect={(id) => useThemeStore.getState().setActiveTheme(id)}
        />
      ))}
    </div>
  </div>
);

const ThemePresetGallery: React.FC<ThemePresetGalleryProps> = ({ onCustomize }) => {
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const customThemes = useThemeStore((state) => state.customThemes);

  return (
    <div className="flex flex-col gap-4">
      <ThemeGroup label="Built-in" themes={COMPOSER_PRESETS} activeThemeId={activeThemeId} />
      <ThemeGroup label="Classics" themes={CLASSIC_PRESETS} activeThemeId={activeThemeId} />
      {customThemes.length > 0 && (
        <ThemeGroup label="Your themes" themes={customThemes} activeThemeId={activeThemeId} custom />
      )}
      {onCustomize && (
        <div>
          <Button variant="secondary" size="sm" onClick={onCustomize}>
            Customize current
          </Button>
        </div>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePresetGallery };
