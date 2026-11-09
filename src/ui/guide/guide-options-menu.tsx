import { IconButton } from "@/ui/icon-button";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { IconBook, IconDots, IconEyeOff, IconLayersSubtract, IconRefresh } from "@tabler/icons-react";
import { useMemo, useState } from "react";

// -- Types --------------------------------------------------------------------

interface GuideOptionsMenuProps {
  showAll: boolean;
  onToggleShowAll: () => void;
  onOpenHelp: () => void;
  onStartOver: () => void;
  onHide: () => void;
}

// -- Component ----------------------------------------------------------------

const GuideOptionsMenu: React.FC<GuideOptionsMenuProps> = ({
  showAll,
  onToggleShowAll,
  onOpenHelp,
  onStartOver,
  onHide,
}) => {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const anchor = useMemo<MenuAnchor | null>(
    () => (open && trigger ? { kind: "element", element: trigger } : null),
    [open, trigger],
  );
  return (
    <>
      <IconButton
        ref={setTrigger}
        variant="ghost"
        label="Guide options"
        icon={<IconDots className="size-4" />}
        {...menuTriggerProps(open)}
        onClick={() => setOpen((shown) => !shown)}
        className="size-7 rounded-lg"
      />
      {trigger && (
        <Menu anchor={anchor} align="end" aria-label="Guide options" onClose={() => setOpen(false)}>
          <MenuItem
            icon={IconLayersSubtract}
            label={showAll ? "Unlock tiers as I go" : "Show every tier now"}
            onSelect={onToggleShowAll}
          />
          <MenuItem icon={IconBook} label="Open this step in Help" onSelect={onOpenHelp} />
          <MenuItem icon={IconRefresh} label="Start over" onSelect={onStartOver} />
          <MenuSeparator />
          <MenuItem icon={IconEyeOff} label="Hide guide" onSelect={onHide} />
        </Menu>
      )}
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { GuideOptionsMenu };
