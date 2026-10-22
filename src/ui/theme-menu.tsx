import { deriveTheme } from "@/domain/theme/derive";
import type { Theme } from "@/domain/theme/model";
import { useThemeStore } from "@/stores/theme";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";
import { Menu, type MenuAnchor, MenuItem, MenuRadioItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { IconPalette } from "@tabler/icons-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

// -- Constants ----------------------------------------------------------------

const SWATCH_TOKENS = ["bg", "accent", "bg-dark", "text"] as const;

// -- Components ---------------------------------------------------------------

const ThemeSwatch: React.FC<{ theme: Theme }> = ({ theme }) => {
  const resolved = deriveTheme(theme);
  return (
    <span
      aria-hidden="true"
      className="grid grid-cols-2 size-7 shrink-0 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(127_127_127/0.3)]"
    >
      {SWATCH_TOKENS.map((token) => (
        <span key={token} style={{ backgroundColor: resolved[token] }} />
      ))}
    </span>
  );
};

const ThemeMenu: React.FC = () => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const favorites = useThemeStore(
    useShallow((state) => state.favoriteThemeIds.flatMap((id) => state.getThemeById(id) ?? [])),
  );
  const activeTheme = useThemeStore((state) => state.getThemeById(state.activeThemeId));
  const setActiveTheme = useThemeStore((state) => state.setActiveTheme);
  const openSettings = useUIStore((state) => state.openSettings);

  if (favorites.length === 0 || !activeTheme) return null;
  const activeColors = deriveTheme(activeTheme);

  return (
    <>
      <Button
        hasIcon
        {...menuTriggerProps(anchor !== null)}
        onClick={(event) => setAnchor(anchor ? null : { kind: "element", element: event.currentTarget })}
        className="h-[34px] mr-1.5 rounded-[10px]"
      >
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-[5px] shadow-[inset_0_0_0_1px_var(--edge-strong)]"
          style={{
            background: `linear-gradient(135deg, ${activeColors.bg} 50%, ${activeColors.accent} 50%)`,
          }}
        />
        <span className="max-[1279px]:sr-only">{activeTheme.name}</span>
      </Button>
      {anchor && (
        <Menu anchor={anchor} onClose={() => setAnchor(null)} aria-label="Favorite themes">
          {favorites.map((theme) => (
            <MenuRadioItem
              key={theme.id}
              lead={<ThemeSwatch theme={theme} />}
              label={theme.name}
              description={theme.scheme === "light" ? "Light" : "Dark"}
              checked={theme.id === activeThemeId}
              onSelect={() => setActiveTheme(theme.id)}
            />
          ))}
          <MenuSeparator />
          <MenuItem
            icon={IconPalette}
            label="All themes"
            onSelect={() => openSettings({ target: { section: "theme" } })}
          />
        </Menu>
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { ThemeMenu };
