import { DesignSection } from "@/pages/design/design-section";
import { PrimitiveBlock, StateCell, StateGrid } from "@/pages/design/state-cell";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ProgressBar } from "@/ui/progress-bar";
import { StatusChip } from "@/ui/status-chip";
import { IconAlertCircle, IconAlertTriangle, IconCheck, IconMusic, IconPlus } from "@tabler/icons-react";

// -- Constants -----------------------------------------------------------------

const PROGRESS_STEPS = [0, 40, 100] as const;

// -- Components ----------------------------------------------------------------

const KeyBadgeBlock: React.FC = () => (
  <PrimitiveBlock
    name="InlineKeyBadge"
    note="Use it to show a shortcut next to the action it runs, read from the shortcut registry."
  >
    <StateGrid>
      <StateCell label="Keys">
        <span className="inline-flex items-center text-[13px] text-(--label) select-none">
          Save
          <InlineKeyBadge keys={getEffectiveKeysArray("global.saveNow")} />
        </span>
      </StateCell>
      <StateCell label="Text">
        <InlineKeyBadge text="Space" />
      </StateCell>
    </StateGrid>
  </PrimitiveBlock>
);

const StatusChipBlock: React.FC = () => (
  <PrimitiveBlock
    name="StatusChip"
    note="Use it to flag the state of a row with an icon and a word, never color alone."
  >
    <StateGrid>
      <StateCell label="warning">
        <StatusChip tone="warning" icon={IconAlertTriangle}>
          2 gaps
        </StatusChip>
      </StateCell>
      <StateCell label="error">
        <StatusChip tone="error" icon={IconAlertCircle}>
          Overlap
        </StatusChip>
      </StateCell>
      <StateCell label="positive">
        <StatusChip tone="positive" icon={IconCheck}>
          Synced
        </StatusChip>
      </StateCell>
    </StateGrid>
  </PrimitiveBlock>
);

const ProgressBarBlock: React.FC = () => (
  <PrimitiveBlock name="ProgressBar" note="Use it for work with a known end, such as sync progress or a download.">
    <StateGrid>
      {PROGRESS_STEPS.map((percent) => (
        <StateCell key={percent} label={`${percent} percent`}>
          <ProgressBar percent={percent} label="Sync progress" className="w-full" />
        </StateCell>
      ))}
      <StateCell label="Segments, 40 percent">
        <ProgressBar percent={40} segments={10} label="Sync progress" className="w-full" />
      </StateCell>
    </StateGrid>
  </PrimitiveBlock>
);

const EmptyStateBlock: React.FC = () => (
  <PrimitiveBlock name="EmptyState" note="Use it where a list has nothing to show yet, and say how to fill it.">
    <StateGrid wide>
      <StateCell label="With an action">
        <EmptyState
          icon={IconMusic}
          message="No projects yet"
          hint="Drop an audio file to start one."
          action={
            <Button hasIcon size="sm" className="mt-2">
              <IconPlus aria-hidden="true" className="size-4" />
              New project
            </Button>
          }
        />
      </StateCell>
      <StateCell label="Message only">
        <EmptyState message="No matches" hint="Try a shorter search." />
      </StateCell>
    </StateGrid>
  </PrimitiveBlock>
);

const BadgesSection: React.FC = () => (
  <DesignSection id="badges" note="Small marks that show status, shortcuts and progress without taking focus.">
    <KeyBadgeBlock />
    <StatusChipBlock />
    <ProgressBarBlock />
    <EmptyStateBlock />
  </DesignSection>
);

// -- Exports -------------------------------------------------------------------

export { BadgesSection };
