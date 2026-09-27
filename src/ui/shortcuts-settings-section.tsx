import { useConfirm } from "@/stores/confirm-store";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { SHORTCUT_SCOPE_GROUPS, getShortcutsByScope } from "@/stores/shortcut-registry";
import { Button } from "@/ui/button";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";
import { IconRefresh } from "@tabler/icons-react";

// -- Component ----------------------------------------------------------------

const ShortcutsSettingsSection: React.FC = () => {
  const resetAllBindings = useShortcutBindingsStore((s) => s.resetAllBindings);
  const overrides = useShortcutBindingsStore((s) => s.overrides);
  const hasOverrides = Object.keys(overrides).length > 0;
  const confirm = useConfirm();

  const handleResetShortcuts = async () => {
    const ok = await confirm({
      title: "Reset all shortcuts?",
      description: "Clear every custom keyboard binding and restore the defaults.",
      confirmLabel: "Reset",
      variant: "destructive",
      settingsKey: "confirmResetShortcuts",
    });
    if (ok) resetAllBindings();
  };

  return (
    <div className="space-y-6 py-4">
      {SHORTCUT_SCOPE_GROUPS.map(({ scope, title }) => (
        <div key={scope}>
          <h3 className="mb-1 text-xs font-medium tracking-wide text-composer-text-muted">{title}</h3>
          <div className="divide-y divide-composer-border">
            {getShortcutsByScope(scope).map((def) => (
              <ShortcutRebindRow key={def.id} definition={def} />
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 border-t border-composer-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-composer-text">Reset all shortcuts</span>
          <span className="text-xs text-composer-text-muted">Restore all keyboard shortcuts to their defaults.</span>
        </div>
        <Button size="sm" variant="secondary" hasIcon onClick={handleResetShortcuts} disabled={!hasOverrides}>
          <IconRefresh size={14} />
          Reset all
        </Button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ShortcutsSettingsSection };
