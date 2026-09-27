import { IconButton } from "@/ui/icon-button";
import { IconHelp, IconRoute, IconSettings } from "@tabler/icons-react";

interface AppHeaderProps {
  onSettingsOpen: () => void;
  onHelpOpen: () => void;
  onTourStart: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onSettingsOpen, onHelpOpen, onTourStart }) => (
  <header className="flex items-center justify-between p-4 border-b select-none border-composer-border">
    <h1 className="text-xl font-semibold">
      <img src="/logo.svg" alt="Composer Logo" className="inline-block size-6 mr-2 -mt-1" />
      Composer
    </h1>
    <div className="flex items-center gap-1">
      <IconButton
        label="Settings"
        icon={<IconSettings className="size-5" />}
        variant="ghost"
        onClick={onSettingsOpen}
      />
      <IconButton label="Product tour" icon={<IconRoute className="size-5" />} variant="ghost" onClick={onTourStart} />
      <IconButton
        label="Keyboard shortcuts (?)"
        icon={<IconHelp className="size-5" />}
        variant="ghost"
        onClick={onHelpOpen}
      />
    </div>
  </header>
);

export { AppHeader };
