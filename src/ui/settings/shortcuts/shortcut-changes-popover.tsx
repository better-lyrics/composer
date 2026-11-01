import type { ShortcutChange } from "@/stores/shortcut-preset-changes";
import type { ShortcutPreset } from "@/stores/shortcut-presets";
import { Button } from "@/ui/button";
import { PopActions, PopBody, PopButton, PopGroup, PopHead, PopText } from "@/ui/pop-layout";
import { Popover } from "@/ui/popover";
import { ShortcutChangeRows } from "@/ui/settings/shortcuts/shortcut-change-rows";
import { resetMyShortcutChanges, switchShortcutPreset } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { pluralize } from "@/utils/pluralize";
import type { Placement } from "@floating-ui/react";
import { IconChevronDown, IconRefresh } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutChangesPopoverProps {
  preset: ShortcutPreset;
  active: boolean;
  presetChanges: readonly ShortcutChange[];
  yours: readonly ShortcutChange[];
  placement: Placement;
}

// -- Helpers -------------------------------------------------------------------

function changesLabel(count: number): string {
  return pluralize(count, "change");
}

function footLabel(presetCount: number, yoursCount: number): string {
  if (presetCount === 0) return `${yoursCount} by you`;
  return yoursCount === 0 ? changesLabel(presetCount) : `${changesLabel(presetCount)} ・ ${yoursCount} by you`;
}

// -- Components ----------------------------------------------------------------

const ShortcutChangesPopover: React.FC<ShortcutChangesPopoverProps> = ({
  preset,
  active,
  presetChanges,
  yours,
  placement,
}) => {
  return (
    <Popover
      placement={placement}
      aria-label={`${preset.name} changes`}
      trigger={
        <Button size="sm" variant="ghost" hasIcon className="h-6 pl-1.5 pr-2 text-[11.5px] rounded-md">
          {footLabel(presetChanges.length, yours.length)}
          <IconChevronDown className="size-3.5" />
        </Button>
      }
    >
      {(close) => (
        <PopBody>
          <PopHead
            title={preset.name}
            meta={presetChanges.length > 0 ? changesLabel(presetChanges.length) : undefined}
          />
          {presetChanges.length > 0 && (
            <>
              <PopText>Keys that differ from Composer. Everything else stays the same.</PopText>
              <PopGroup className="mt-2">
                <ShortcutChangeRows changes={presetChanges} />
              </PopGroup>
            </>
          )}
          {yours.length > 0 && (
            <PopGroup label={`Changed by you, on top of ${preset.name}`}>
              <ShortcutChangeRows changes={yours} />
            </PopGroup>
          )}
          {(!active || yours.length > 0) && (
            <PopActions className="mt-3">
              {active ? (
                <PopButton
                  icon={IconRefresh}
                  onClick={() => {
                    close();
                    void resetMyShortcutChanges();
                  }}
                >
                  Reset my changes
                </PopButton>
              ) : (
                <PopButton
                  variant="primary"
                  onClick={() => {
                    close();
                    void switchShortcutPreset(preset.id);
                  }}
                >
                  Use {preset.name}
                </PopButton>
              )}
            </PopActions>
          )}
        </PopBody>
      )}
    </Popover>
  );
};

// -- Exports -------------------------------------------------------------------

export { ShortcutChangesPopover };
