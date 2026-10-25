import type { Theme } from "@/domain/theme/model";
import { PRESETS } from "@/domain/theme/presets";
import { useConfirm } from "@/stores/confirm-store";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { ThemePresetCard } from "@/ui/settings/theme/theme-preset-card";
import { IconPalette } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemePresetGalleryProps {
  onCustomize?: () => void;
  onEditCustom?: (id: string) => void;
}

interface ThemeGroupProps {
  label: string;
  themes: Theme[];
  activeThemeId: string;
  favoriteThemeIds: readonly string[];
  custom?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// -- Constants -----------------------------------------------------------------

const GROUP_GRID = "grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2.5";

const GROUP_LABEL = "text-xs font-semibold text-(--muted) select-none";

const COMPOSER_PRESETS = PRESETS.filter((theme) => theme.group === "Composer");

const CLASSIC_PRESETS = PRESETS.filter((theme) => theme.group === "Classics");

// -- Components ----------------------------------------------------------------

const ThemeGroup: React.FC<ThemeGroupProps> = ({
  label,
  themes,
  activeThemeId,
  favoriteThemeIds,
  custom = false,
  onEdit,
  onDelete,
}) => {
  const favorites = new Set(favoriteThemeIds);
  return (
    <div className="flex flex-col gap-2.5 mt-[18px]">
      <span className={GROUP_LABEL}>{label}</span>
      <div className={GROUP_GRID}>
        {themes.map((theme) => (
          <ThemePresetCard
            key={theme.id}
            theme={theme}
            active={theme.id === activeThemeId}
            favorite={favorites.has(theme.id)}
            onToggleFavorite={(id) => useThemeStore.getState().toggleFavoriteTheme(id)}
            custom={custom}
            onSelect={(id) => useThemeStore.getState().setActiveTheme(id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

const ThemePresetGallery: React.FC<ThemePresetGalleryProps> = ({ onCustomize, onEditCustom }) => {
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const customThemes = useThemeStore((state) => state.customThemes);
  const favoriteThemeIds = useThemeStore((state) => state.favoriteThemeIds);
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
    <div className="flex flex-col">
      <ThemeGroup
        label="Built-in"
        themes={COMPOSER_PRESETS}
        activeThemeId={activeThemeId}
        favoriteThemeIds={favoriteThemeIds}
      />
      <ThemeGroup
        label="Classics"
        themes={CLASSIC_PRESETS}
        activeThemeId={activeThemeId}
        favoriteThemeIds={favoriteThemeIds}
      />
      {customThemes.length > 0 && (
        <ThemeGroup
          label="Your themes"
          themes={customThemes}
          activeThemeId={activeThemeId}
          favoriteThemeIds={favoriteThemeIds}
          custom
          onEdit={onEditCustom}
          onDelete={handleDelete}
        />
      )}
      {onCustomize && (
        <div className="flex justify-end mt-3.5">
          <Button variant="secondary" size="lg" hasIcon onClick={onCustomize}>
            <IconPalette className="size-4" />
            Customize current
          </Button>
        </div>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePresetGallery };
