import { DesignSection } from "@/pages/design/design-section";
import { InteractionCells, ResultLine } from "@/pages/design/primitives/interaction-cells";
import { ChoiceBlock, ConfirmBlock, ModalBlock } from "@/pages/design/primitives/overlay-prompts";
import { PrimitiveBlock, StateCell, StateGrid } from "@/pages/design/state-cell";
import { Button } from "@/ui/button";
import { Menu, type MenuAnchor, MenuItem, MenuSeparator } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { Popover } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { IconCopy, IconFolder, IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface DemoMenuProps {
  disabled: boolean;
  onPick: (label: string) => void;
}

// -- Components ----------------------------------------------------------------

const DemoMenu: React.FC<DemoMenuProps> = ({ disabled, onPick }) => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return (
    <>
      <Button
        hasIcon
        disabled={disabled}
        {...menuTriggerProps(anchor !== null)}
        onClick={(event) => setAnchor(anchor ? null : { kind: "element", element: event.currentTarget })}
      >
        <IconFolder aria-hidden="true" className="size-4" />
        Project
      </Button>
      <Menu anchor={anchor} onClose={() => setAnchor(null)} aria-label="Project actions">
        <MenuItem icon={IconPencil} label="Rename" onSelect={() => onPick("Rename")} />
        <MenuItem icon={IconCopy} label="Duplicate" shortcut={["Mod", "D"]} onSelect={() => onPick("Duplicate")} />
        <MenuSeparator />
        <MenuItem icon={IconTrash} label="Delete" tone="danger" onSelect={() => onPick("Delete")} />
      </Menu>
    </>
  );
};

const MenuBlock: React.FC = () => {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <PrimitiveBlock name="Menu" note="Use it for a short list of actions on one thing, opened from a button.">
      <StateGrid>
        <InteractionCells
          render={(disabled) => <DemoMenu disabled={disabled} onPick={(label) => setPicked(`Picked ${label}`)} />}
        />
      </StateGrid>
      <ResultLine result={picked} />
    </PrimitiveBlock>
  );
};

const DemoPopover: React.FC<{ disabled: boolean }> = ({ disabled }) => (
  <Popover
    aria-label="Song details"
    trigger={
      <Button disabled={disabled} className="aria-expanded:bg-(--layer-1)">
        Details
      </Button>
    }
  >
    <div className="flex flex-col gap-1 w-56 p-3.5">
      <p className="text-[13px] font-semibold text-composer-text">Midnight City</p>
      <p className="text-xs text-(--muted) text-pretty">M83, 4:03. Word synced, 48 of 52 lines timed.</p>
    </div>
  </Popover>
);

const PopoverBlock: React.FC = () => (
  <PrimitiveBlock name="Popover" note="Use it for extra detail or a small form tied to the button that opens it.">
    <StateGrid>
      <InteractionCells render={(disabled) => <DemoPopover disabled={disabled} />} />
    </StateGrid>
  </PrimitiveBlock>
);

const TooltipBlock: React.FC = () => (
  <PrimitiveBlock name="Tooltip" note="Use it for a short hint on hover or focus, never for anything you must read.">
    <StateGrid>
      <StateCell label="Hover or Tab to it">
        <Tooltip content="Saved 2 minutes ago">
          <Button variant="ghost">Saved</Button>
        </Tooltip>
      </StateCell>
    </StateGrid>
  </PrimitiveBlock>
);

const OverlaysSection: React.FC = () => (
  <DesignSection id="overlays" note="Overlays float above the page, and Escape always closes the top one first.">
    <MenuBlock />
    <PopoverBlock />
    <TooltipBlock />
    <ModalBlock />
    <ConfirmBlock />
    <ChoiceBlock />
  </DesignSection>
);

// -- Exports -------------------------------------------------------------------

export { OverlaysSection };
