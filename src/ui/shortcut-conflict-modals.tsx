import { bindingToKeys } from "@/stores/shortcut-bindings";
import type { ShortcutBinding, ShortcutDefinition } from "@/stores/shortcut-registry";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { KeyBadge } from "@/ui/shortcut-reference";

// -- Browser Warning Modal ----------------------------------------------------

const BrowserWarningModal: React.FC<{
  binding: ShortcutBinding;
  onContinue: () => void;
  onCancel: () => void;
}> = ({ binding, onCancel, onContinue }) => {
  const bindingKeys = bindingToKeys(binding);

  return (
    <Modal isOpen onClose={onCancel} title="Browser shortcut">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-composer-text">
          <span className="inline-flex items-center gap-1">
            {bindingKeys.map((key) => (
              <KeyBadge key={key} keyName={key} />
            ))}
          </span>
          <span className="text-composer-text-secondary">may be reserved by the browser.</span>
        </div>
        <p className="text-xs text-composer-text-muted">
          This combination might be handled by your browser before it reaches the app. You can still assign it, but it
          may not work in all browsers.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onContinue}>
            Assign anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// -- Conflict Modal -----------------------------------------------------------

const SCOPE_LABELS: Record<string, string> = {
  global: "General",
  sync: "Sync Mode",
  timeline: "Timeline Mode",
};

const ConflictModal: React.FC<{
  newBinding: ShortcutBinding;
  conflicts: ShortcutDefinition[];
  onReplace: () => void;
  onCancel: () => void;
}> = ({ newBinding, conflicts, onReplace, onCancel }) => {
  const bindingKeys = bindingToKeys(newBinding);

  return (
    <Modal isOpen onClose={onCancel} title="Shortcut conflict">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-composer-text">
          <span className="inline-flex items-center gap-1">
            {bindingKeys.map((key) => (
              <KeyBadge key={key} keyName={key} />
            ))}
          </span>
          <span className="text-composer-text-secondary">is already used by:</span>
        </div>

        <div className="rounded-lg bg-composer-bg-elevated border border-composer-border divide-y divide-composer-border">
          {conflicts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm text-composer-text">{c.description}</span>
              <span className="text-xs text-composer-text-muted">{SCOPE_LABELS[c.scope] ?? c.scope}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-composer-text-muted">Replacing will leave the conflicting shortcut unbound.</p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onReplace}>
            Replace
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { BrowserWarningModal, ConflictModal };
