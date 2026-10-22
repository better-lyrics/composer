import { IconButton } from "@/ui/icon-button";
import { ProjectBreadcrumb } from "@/ui/projects/project-breadcrumb";
import { TabBar } from "@/ui/tab-bar";
import { ThemeMenu } from "@/ui/theme-menu";
import { type AppScreen, LIBRARY_PATH } from "@/utils/app-routes";
import { IconHelp, IconRoute, IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";

// -- Types --------------------------------------------------------------------

interface AppHeaderActions {
  onSettingsOpen: () => void;
  onHelpOpen: () => void;
  onTourStart: () => void;
}

interface AppHeaderProps extends AppHeaderActions {
  screen: AppScreen;
}

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

// -- Component ----------------------------------------------------------------

const HEADER_ICON_STYLES = "size-9 rounded-[10px] text-(--muted) hover:text-composer-text hover:bg-(--layer-2)";

const AppHeader: React.FC<AppHeaderProps> = ({ screen, onSettingsOpen, onHelpOpen, onTourStart }) => (
  <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 h-14 shrink-0 pl-4 pr-3 select-none">
    {screen === "editor" ? <EditorBrand /> : <LibraryBrand />}
    {screen === "editor" ? <TabBar /> : <span />}
    <div className="flex items-center justify-end gap-1 min-w-0">
      <ThemeMenu />
      <IconButton
        label="Settings"
        icon={<IconSettings className="size-5" />}
        variant="ghost"
        onClick={onSettingsOpen}
        className={HEADER_ICON_STYLES}
      />
      <IconButton
        label="Product tour"
        icon={<IconRoute className="size-5" />}
        variant="ghost"
        onClick={onTourStart}
        className={HEADER_ICON_STYLES}
      />
      <IconButton
        label="Keyboard shortcuts (?)"
        icon={<IconHelp className="size-5" />}
        variant="ghost"
        onClick={onHelpOpen}
        className={HEADER_ICON_STYLES}
      />
    </div>
  </header>
);

// -- Exports ------------------------------------------------------------------

export { AppHeader };
