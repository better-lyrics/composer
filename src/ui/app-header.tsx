import { HEADER_ICON_STYLES } from "@/ui/header-icon-styles";
import { IconButton } from "@/ui/icon-button";
import { ProjectBreadcrumb } from "@/ui/projects/project-breadcrumb";
import { TabBar } from "@/ui/tab-bar";
import { TabStrip } from "@/ui/tab-strip";
import { ThemeMenu } from "@/ui/theme-menu";
import { HeaderAccount } from "@/ui/unison/account-menu";
import { type AppScreen, LIBRARY_PATH, UNISON_PATH } from "@/utils/app-routes";
import { IconHelp, IconRoute, IconSettings } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

// -- Types --------------------------------------------------------------------

interface AppHeaderActions {
  onSettingsOpen: () => void;
  onHelpOpen: () => void;
  onTourStart: () => void;
}

interface AppHeaderProps extends AppHeaderActions {
  screen: AppScreen;
}

type BrowseScreen = Exclude<AppScreen, "editor">;

// -- Constants ----------------------------------------------------------------

const BROWSE_TABS = [
  { id: "library", label: "Projects" },
  { id: "unison", label: "Unison" },
] as const satisfies readonly { id: BrowseScreen; label: string }[];

const BROWSE_PATHS: Record<BrowseScreen, string> = { library: LIBRARY_PATH, unison: UNISON_PATH };

const BROWSE_NAV_ATTRIBUTES = { "aria-label": "Projects and Unison" };

// -- Sub-components -------------------------------------------------------------

const EditorBrand: React.FC = () => (
  <div className="flex items-center gap-3 min-w-0">
    <h1 className="shrink-0">
      <img src="/logo.svg" alt="Composer Logo" className="block size-6" />
      <span className="sr-only">Composer</span>
    </h1>
    <ProjectBreadcrumb />
  </div>
);

const LibraryBrand: React.FC = () => (
  <Link
    to={LIBRARY_PATH}
    aria-label="Composer, Projects"
    className="inline-flex items-center gap-3 text-[19px] font-bold tracking-[-0.01em] text-composer-text cursor-pointer"
  >
    <img src="/logo.svg" alt="" className="block size-6" />
    Composer
  </Link>
);

const BrowseSwitcher: React.FC<{ screen: BrowseScreen }> = ({ screen }) => {
  const navigate = useNavigate();
  return (
    <TabStrip
      tabs={BROWSE_TABS}
      active={screen}
      onSelect={(next) => {
        if (next !== screen) navigate(BROWSE_PATHS[next]);
      }}
      navAttributes={BROWSE_NAV_ATTRIBUTES}
    />
  );
};

// -- Component ----------------------------------------------------------------

const AppHeader: React.FC<AppHeaderProps> = ({ screen, onSettingsOpen, onHelpOpen, onTourStart }) => (
  <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 h-14 shrink-0 pl-4 pr-3 select-none">
    {screen === "editor" ? <EditorBrand /> : <LibraryBrand />}
    {screen === "editor" ? <TabBar /> : <BrowseSwitcher screen={screen} />}
    <div className="flex items-center justify-end gap-1 min-w-0">
      <ThemeMenu />
      <IconButton
        label="Settings"
        icon={<IconSettings className="size-[18px]" />}
        variant="ghost"
        onClick={onSettingsOpen}
        className={HEADER_ICON_STYLES}
      />
      <IconButton
        label="Product tour"
        icon={<IconRoute className="size-[18px]" />}
        variant="ghost"
        onClick={onTourStart}
        className={HEADER_ICON_STYLES}
      />
      <IconButton
        label="Keyboard shortcuts (?)"
        icon={<IconHelp className="size-[18px]" />}
        variant="ghost"
        onClick={onHelpOpen}
        className={HEADER_ICON_STYLES}
      />
      <span aria-hidden="true" className="w-px h-5 mx-1.5 bg-(--divider)" />
      <HeaderAccount />
    </div>
  </header>
);

// -- Exports ------------------------------------------------------------------

export { AppHeader };
