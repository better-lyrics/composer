import { Button } from "@/ui/button";
import { IconHelp, IconLayoutGrid, IconRoute, IconSettings } from "@tabler/icons-react";

interface AppHeaderProps {
  onSettingsOpen: () => void;
  onHelpOpen: () => void;
  onTourStart: () => void;
  onLibraryOpen: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onSettingsOpen, onHelpOpen, onTourStart, onLibraryOpen }) => (
  <header className="flex items-center justify-between p-4 border-b select-none border-composer-border">
    <h1 className="text-xl font-semibold">
      <img src="/logo.svg" alt="Composer Logo" className="inline-block size-6 mr-2 -mt-1" />
      Composer
    </h1>
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" onClick={onLibraryOpen} title="Library">
        <IconLayoutGrid className="size-5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onSettingsOpen} title="Settings">
        <IconSettings className="size-5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onTourStart} title="Product tour">
        <IconRoute className="size-5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onHelpOpen} title="Keyboard shortcuts (?)">
        <IconHelp className="size-5" />
      </Button>
    </div>
  </header>
);

export { AppHeader };
