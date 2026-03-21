import { Button } from "@/ui/button";
import { IconHelp, IconRoute, IconSettings } from "@tabler/icons-react";

interface AppHeaderProps {
  onSettingsOpen: () => void;
  onHelpOpen: () => void;
  onTourStart: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onSettingsOpen, onHelpOpen, onTourStart }) => (
  <header className="flex items-center justify-between p-4 border-b select-none border-composer-border">
    <h1 className="text-xl font-bold">
      <img src="/logo.svg" alt="Composer Logo" className="inline-block w-6 h-6 mr-2 -mt-1" />
      Composer
    </h1>
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" onClick={onSettingsOpen} title="Settings">
        <IconSettings className="w-5 h-5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onTourStart} title="Product tour">
        <IconRoute className="w-5 h-5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onHelpOpen} title="Keyboard shortcuts (?)">
        <IconHelp className="w-5 h-5" />
      </Button>
    </div>
  </header>
);

export { AppHeader };
