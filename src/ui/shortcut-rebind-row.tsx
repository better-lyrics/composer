import {
  assignBinding,
  bindingToKeys,
  detectConflicts,
  getEffectiveKeysArray,
  useShortcutBindingsStore,
} from "@/stores/shortcut-bindings";
import type { ShortcutBinding, ShortcutDefinition } from "@/stores/shortcut-registry";
import { Button } from "@/ui/button";
import { KeyBadge } from "@/ui/shortcut-reference";
import { Modal } from "@/ui/modal";
import { MOD_KEY } from "@/utils/platform";
import { bindingFromKeyboardEvent, isReservedBrowserShortcut } from "@/utils/shortcut-matcher";
import { useCallback, useEffect, useState } from "react";
import { HighlightMatches } from "@/ui/highlight-matches";
import { useSettingsSearchQuery } from "@/ui/settings/settings-search-query";

// -- Types --------------------------------------------------------------------

interface ShortcutRebindRowProps {
  definition: ShortcutDefinition;
}

type CaptureState =
  | { status: "idle" }
  | { status: "listening" }
  | { status: "warning"; newBinding: ShortcutBinding }
  | { status: "conflict"; newBinding: ShortcutBinding; conflicts: ShortcutDefinition[] };

// -- Helpers ------------------------------------------------------------------

function spokenKeys(keys: string[]): string {
  if (keys.length === 0) return "Unbound";
  return keys.map((key) => (key === "Mod" ? MOD_KEY : key)).join("+");
}

// -- Component ----------------------------------------------------------------

const ShortcutRebindRow: React.FC<ShortcutRebindRowProps> = ({ definition }) => {
  const searchQuery = useSettingsSearchQuery();
  const [captureState, setCaptureState] = useState<CaptureState>({ status: "idle" });
  const resetBinding = useShortcutBindingsStore((s) => s.resetBinding);
  const overrides = useShortcutBindingsStore((s) => s.overrides);
  const isOverridden = definition.id in overrides;

  const keys = getEffectiveKeysArray(definition.id);

  const startCapture = useCallback(() => {
    setCaptureState({ status: "listening" });
  }, []);

  const cancelCapture = useCallback(() => {
    setCaptureState({ status: "idle" });
  }, []);

  const replaceConflicts = useCallback(
    (binding: ShortcutBinding) => {
      assignBinding(definition.id, binding);
      setCaptureState({ status: "idle" });
    },
    [definition.id],
  );

  const applyCapturedBinding = useCallback(
    (binding: ShortcutBinding) => {
      const conflicts = detectConflicts(definition.id, binding);
      if (conflicts.length > 0) {
        setCaptureState({ status: "conflict", newBinding: binding, conflicts });
      } else {
        assignBinding(definition.id, binding);
        setCaptureState({ status: "idle" });
      }
    },
    [definition.id],
  );

  useEffect(() => {
    if (captureState.status !== "listening") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        cancelCapture();
        return;
      }

      const newBinding = bindingFromKeyboardEvent(e);
      if (!newBinding) return;

      if (isReservedBrowserShortcut(newBinding)) {
        setCaptureState({ status: "warning", newBinding });
        return;
      }

      applyCapturedBinding(newBinding);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [captureState.status, cancelCapture, applyCapturedBinding]);

  return (
    <>
      <div className="flex items-center justify-between py-2.5">
        <span className="text-sm text-composer-text-secondary">
          <HighlightMatches text={definition.description} query={searchQuery} />
        </span>
        <div className="flex items-center gap-2">
          {isOverridden && (
            <button
              type="button"
              onClick={() => resetBinding(definition.id)}
              className="text-xs text-composer-text-muted hover:text-composer-text cursor-pointer transition-colors"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            aria-label={`Change shortcut for ${definition.description}, currently ${spokenKeys(keys)}`}
            onClick={startCapture}
            className="flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors hover:bg-composer-button/50"
          >
            {keys.length === 0 ? (
              <span className="text-xs text-composer-text-muted italic">Unbound</span>
            ) : (
              keys.map((key) => <KeyBadge key={key} keyName={key} />)
            )}
          </button>
        </div>
      </div>

      <Modal isOpen={captureState.status === "listening"} onClose={cancelCapture} title="Rebind shortcut">
        <div className="text-center py-4">
          <p className="text-sm text-composer-text-secondary mb-1">Press a new key combination</p>
          <p className="text-xs text-composer-text-muted">Press Escape to cancel</p>
        </div>
      </Modal>

      {captureState.status === "warning" && (
        <BrowserWarningModal
          binding={captureState.newBinding}
          onContinue={() => applyCapturedBinding(captureState.newBinding)}
          onCancel={cancelCapture}
        />
      )}

      {captureState.status === "conflict" && (
        <ConflictModal
          newBinding={captureState.newBinding}
          conflicts={captureState.conflicts}
          onReplace={() => replaceConflicts(captureState.newBinding)}
          onCancel={cancelCapture}
        />
      )}
    </>
  );
};

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

export { ShortcutRebindRow };
