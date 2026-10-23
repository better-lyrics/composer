import { DesignSection } from "@/pages/design/design-section";
import { InteractionCells } from "@/pages/design/primitives/interaction-cells";
import { PrimitiveBlock, StateCell, StateGrid } from "@/pages/design/state-cell";
import { Button } from "@/ui/button";
import type { ButtonVariant } from "@/ui/button-class-name";
import { IconButton } from "@/ui/icon-button";
import { LinkButton } from "@/ui/link-button";
import { ToggleButton } from "@/ui/toggle-button";
import { IconDownload, IconPlus, IconRepeat } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface VariantEntry {
  variant: ButtonVariant;
  name: string;
  note: string;
  label: string;
}

// -- Constants -----------------------------------------------------------------

const VARIANTS: readonly VariantEntry[] = [
  {
    variant: "primary",
    name: "Primary",
    note: "Use it for the one main action in a view, such as Export.",
    label: "Export",
  },
  {
    variant: "secondary",
    name: "Secondary",
    note: "Use it for everyday actions, and as the default when nothing on the screen leads.",
    label: "Import lyrics",
  },
  {
    variant: "ghost",
    name: "Ghost",
    note: "Use it in toolbars and dense rows, where a raised button would be too loud.",
    label: "Clear",
  },
  {
    variant: "latch",
    name: "Latch",
    note: "Use it to show a control that is switched on; ToggleButton picks it for you.",
    label: "Snap",
  },
  {
    variant: "quiet",
    name: "Quiet",
    note: "Use it for chrome actions that should fade back until you point at them.",
    label: "Shortcuts",
  },
  {
    variant: "danger",
    name: "Danger",
    note: "Use it for a destructive action in a list or panel that asks for a confirm next.",
    label: "Remove",
  },
  {
    variant: "destructive",
    name: "Destructive",
    note: "Use it for the final confirm of an action that deletes work.",
    label: "Delete project",
  },
];

// -- Components ----------------------------------------------------------------

const VariantBlock: React.FC<VariantEntry> = ({ variant, name, note, label }) => (
  <PrimitiveBlock name={name} note={note}>
    <StateGrid>
      <InteractionCells
        render={(disabled) => (
          <Button variant={variant} disabled={disabled}>
            {label}
          </Button>
        )}
      />
    </StateGrid>
  </PrimitiveBlock>
);

const SizesBlock: React.FC = () => (
  <PrimitiveBlock name="Sizes" note="Use md almost everywhere, sm in dense rows and lg for a page level action.">
    <StateGrid>
      <StateCell label="sm">
        <Button size="sm">Small</Button>
      </StateCell>
      <StateCell label="md">
        <Button size="md">Medium</Button>
      </StateCell>
      <StateCell label="lg">
        <Button size="lg">Large</Button>
      </StateCell>
      <StateCell label="icon, through IconButton">
        <IconButton label="Add line" icon={<IconPlus aria-hidden="true" className="size-4" />} />
      </StateCell>
    </StateGrid>
  </PrimitiveBlock>
);

const HasIconBlock: React.FC = () => (
  <PrimitiveBlock
    name="With an icon"
    note="Set hasIcon when a label leads with an icon, so the right side gets the extra padding it needs."
  >
    <StateGrid>
      <InteractionCells
        render={(disabled) => (
          <Button hasIcon disabled={disabled}>
            <IconDownload aria-hidden="true" className="size-4" />
            Download
          </Button>
        )}
      />
    </StateGrid>
  </PrimitiveBlock>
);

const IconButtonBlock: React.FC = () => (
  <PrimitiveBlock
    name="IconButton"
    note="Use it for an icon with no text. Its required label names it for screen readers."
  >
    <StateGrid>
      <InteractionCells
        render={(disabled) => (
          <IconButton
            label="Add line"
            variant="ghost"
            disabled={disabled}
            icon={<IconPlus aria-hidden="true" className="size-4" />}
          />
        )}
      />
    </StateGrid>
  </PrimitiveBlock>
);

const LinkButtonBlock: React.FC = () => (
  <PrimitiveBlock name="LinkButton" note="Use it when a button goes somewhere, so it stays a real link.">
    <StateGrid>
      <InteractionCells
        render={(disabled) => (
          <LinkButton to="/design" disabled={disabled}>
            Design system
          </LinkButton>
        )}
      />
    </StateGrid>
  </PrimitiveBlock>
);

const DemoToggle: React.FC<{ disabled: boolean }> = ({ disabled }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <ToggleButton hasIcon pressed={pressed} disabled={disabled} onClick={() => setPressed(!pressed)}>
      <IconRepeat aria-hidden="true" className="size-4" />
      Loop
    </ToggleButton>
  );
};

const ToggleButtonBlock: React.FC = () => (
  <PrimitiveBlock name="ToggleButton" note="Use it for an on or off mode that a press flips, such as Loop.">
    <StateGrid>
      <InteractionCells render={(disabled) => <DemoToggle disabled={disabled} />} />
    </StateGrid>
  </PrimitiveBlock>
);

const ButtonsSection: React.FC = () => (
  <DesignSection id="buttons" note="Every action in Composer uses these buttons.">
    {VARIANTS.map((entry) => (
      <VariantBlock key={entry.variant} {...entry} />
    ))}
    <SizesBlock />
    <HasIconBlock />
    <IconButtonBlock />
    <LinkButtonBlock />
    <ToggleButtonBlock />
  </DesignSection>
);

// -- Exports -------------------------------------------------------------------

export { ButtonsSection };
