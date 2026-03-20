import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { type ShortcutScope, getShortcutsByScope } from "@/stores/shortcut-registry";
import { Button } from "@/ui/button";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";
import { IconRefresh } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const SCOPE_GROUPS: { scope: ShortcutScope; title: string }[] = [
  { scope: "global", title: "General" },
  { scope: "sync", title: "Sync Mode" },
  { scope: "timeline", title: "Timeline Mode" },
];

// -- Component ----------------------------------------------------------------

const ShortcutsSettingsSection: React.FC = () => {
  const resetAllBindings = useShortcutBindingsStore((s) => s.resetAllBindings);
  const overrides = useShortcutBindingsStore((s) => s.overrides);
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-6 py-4">
      {SCOPE_GROUPS.map(({ scope, title }) => {
        const shortcuts = getShortcutsByScope(scope);
        return (
          <div key={scope}>
            <h3 className="mb-1 text-xs font-medium tracking-wide text-composer-text-muted">{title}</h3>
            <div className="divide-y divide-composer-border">
              {shortcuts.map((def) => (
                <ShortcutRebindRow key={def.id} definition={def} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 border-t border-composer-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-composer-text">Reset all shortcuts</span>
          <span className="text-xs text-composer-text-muted">Restore all keyboard shortcuts to their defaults.</span>
        </div>
        <Button size="sm" variant="secondary" hasIcon onClick={resetAllBindings} disabled={!hasOverrides}>
          <IconRefresh size={14} />
          Reset all
        </Button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ShortcutsSettingsSection };
