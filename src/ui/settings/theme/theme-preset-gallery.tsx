import { useThemeStore } from "@/stores/theme";
import { PRESETS } from "@/domain/theme/presets";
import type { Theme } from "@/domain/theme/model";
import { useConfirm } from "@/stores/confirm-store";
import { Button } from "@/ui/button";
import { ThemePresetCard } from "@/ui/settings/theme/theme-preset-card";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetGalleryProps {
  onCustomize?: () => void;
  onEditCustom?: (id: string) => void;
}

interface ThemeGroupProps {
  label: string;
  themes: Theme[];
  activeThemeId: string;
  custom?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// -- Constants -----------------------------------------------------------------

const GROUP_GRID = "grid grid-cols-3 gap-2.5";

const GROUP_LABEL = "font-mono text-[10.5px] tracking-wider text-composer-text-faint select-none";

const COMPOSER_PRESETS = PRESETS.filter((theme) => theme.group === "Composer");

const CLASSIC_PRESETS = PRESETS.filter((theme) => theme.group === "Classics");

// -- Components ----------------------------------------------------------------

const ThemeGroup: React.FC<ThemeGroupProps> = ({ label, themes, activeThemeId, custom = false, onEdit, onDelete }) => (
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
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  </div>
);

const ThemePresetGallery: React.FC<ThemePresetGalleryProps> = ({ onCustomize, onEditCustom }) => {
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const customThemes = useThemeStore((state) => state.customThemes);
  const confirm = useConfirm();

  const handleDelete = async (id: string) => {
    const theme = customThemes.find((entry) => entry.id === id);
    const confirmed = await confirm({
      title: "Delete theme?",
      description: `"${theme?.name ?? "This theme"}" will be removed permanently.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (confirmed) useThemeStore.getState().deleteCustomTheme(id);
  };

  return (
    <div className="flex flex-col gap-4">
      <ThemeGroup label="Built-in" themes={COMPOSER_PRESETS} activeThemeId={activeThemeId} />
      <ThemeGroup label="Classics" themes={CLASSIC_PRESETS} activeThemeId={activeThemeId} />
      {customThemes.length > 0 && (
        <ThemeGroup
          label="Your themes"
          themes={customThemes}
          activeThemeId={activeThemeId}
          custom
          onEdit={onEditCustom}
          onDelete={handleDelete}
        />
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
