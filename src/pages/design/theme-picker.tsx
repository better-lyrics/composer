import { PRESETS } from "@/domain/theme/presets";
import { useThemeStore } from "@/stores/theme";
import { Select } from "@/ui/select";
import { ThemeSwatch } from "@/ui/theme-menu";

// -- Components ----------------------------------------------------------------

const ThemePicker: React.FC = () => {
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const setActiveTheme = useThemeStore((state) => state.setActiveTheme);
  const customThemes = useThemeStore((state) => state.customThemes);
  const themes = [...PRESETS, ...customThemes];
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));

  return (
    <Select
      aria-label="Theme"
      value={activeThemeId}
      onChange={setActiveTheme}
      options={themes.map((theme) => ({ value: theme.id, label: theme.name }))}
      renderOption={(option) => {
        const theme = themeById.get(option.value);
        return (
          <span className="flex items-center gap-2 min-w-0">
            {theme && <ThemeSwatch theme={theme} />}
            <span className="truncate">{option.label}</span>
          </span>
        );
      }}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemePicker };
