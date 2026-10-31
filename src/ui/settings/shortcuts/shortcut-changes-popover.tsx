import { IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { useConfirm } from "@/stores/confirm-store";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import type { ShortcutChange } from "@/stores/shortcut-preset-changes";
import type { ShortcutPreset } from "@/stores/shortcut-presets";
import { Button } from "@/ui/button";
import { PopActions, PopBody, PopButton, PopGroup, PopHead, PopText } from "@/ui/pop-layout";
import { Popover } from "@/ui/popover";
import { ShortcutChangeRows } from "@/ui/settings/shortcuts/shortcut-change-rows";
import { switchShortcutPreset } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { pluralize } from "@/utils/pluralize";

// -- Interfaces ----------------------------------------------------------------

interface ShortcutChangesPopoverProps {
  preset: ShortcutPreset;
  active: boolean;
  presetChanges: readonly ShortcutChange[];
  yours: readonly ShortcutChange[];
}

// -- Helpers -------------------------------------------------------------------

function changesLabel(count: number): string {
  return pluralize(count, "change");
}

function footLabel(presetCount: number, yoursCount: number): string {
  if (presetCount === 0) return `${yoursCount} yours`;
  return yoursCount === 0 ? changesLabel(presetCount) : `${changesLabel(presetCount)} ・ ${yoursCount} yours`;
}

// -- Components ----------------------------------------------------------------

const ShortcutChangesPopover: React.FC<ShortcutChangesPopoverProps> = ({ preset, active, presetChanges, yours }) => {
  const confirm = useConfirm();

  const resetMyChanges = async (close: () => void) => {
    close();
    const ok = await confirm({
      title: "Reset your changes?",
      description: `Clear the keys you changed and go back to ${preset.name} as it comes.`,
      confirmLabel: "Reset",
      variant: "destructive",
      settingsKey: "confirmResetShortcuts",
    });
    if (ok) useShortcutBindingsStore.getState().resetAllBindings();
  };

  return (
    <Popover
      placement="bottom-start"
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
                <PopButton icon={IconRefresh} onClick={() => void resetMyChanges(close)}>
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
