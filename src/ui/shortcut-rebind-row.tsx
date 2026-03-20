import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import type { ShortcutBinding, ShortcutDefinition } from "@/stores/shortcut-registry";
import { Button } from "@/ui/button";
import { KeyBadge } from "@/ui/help-modal";
import { Modal } from "@/ui/modal";
import { detectConflicts } from "@/utils/shortcut-matcher";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface ShortcutRebindRowProps {
  definition: ShortcutDefinition;
}

type CaptureState =
  | { status: "idle" }
  | { status: "listening" }
  | { status: "conflict"; newBinding: ShortcutBinding; conflicts: ShortcutDefinition[] };

// -- Component ----------------------------------------------------------------

const ShortcutRebindRow: React.FC<ShortcutRebindRowProps> = ({ definition }) => {
  const [captureState, setCaptureState] = useState<CaptureState>({ status: "idle" });
  const overlayRef = useRef<HTMLDivElement>(null);
  const setBinding = useShortcutBindingsStore((s) => s.setBinding);
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

  const applyBinding = useCallback(
    (binding: ShortcutBinding, conflicting: ShortcutDefinition[]) => {
      for (const c of conflicting) {
        resetBinding(c.id);
      }
      setBinding(definition.id, binding);
      setCaptureState({ status: "idle" });
    },
    [definition.id, setBinding, resetBinding],
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

      if (e.key === "Shift" || e.key === "Alt" || e.key === "Control" || e.key === "Meta") return;

      const newBinding: ShortcutBinding = {
        key: e.key,
        ...(e.shiftKey && { shift: true }),
        ...(e.altKey && { alt: true }),
      };

      const conflicts = detectConflicts(definition.id, newBinding);
      if (conflicts.length > 0) {
        setCaptureState({ status: "conflict", newBinding, conflicts });
      } else {
        setBinding(definition.id, newBinding);
        setCaptureState({ status: "idle" });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [captureState.status, definition.id, setBinding, cancelCapture]);

  return (
    <>
      <div className="flex items-center justify-between py-2.5">
        <span className="text-sm text-composer-text-secondary">{definition.description}</span>
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
            onClick={startCapture}
            className="flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors hover:bg-composer-button/50"
          >
            {keys.map((key, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: key order is fixed
              <KeyBadge key={`${key}-${i}`} keyName={key} />
            ))}
          </button>
        </div>
      </div>

      {captureState.status === "listening" && <KeyCaptureOverlay onCancel={cancelCapture} ref={overlayRef} />}

      {captureState.status === "conflict" && (
        <ConflictModal
          newBinding={captureState.newBinding}
          conflicts={captureState.conflicts}
          onReplace={() => applyBinding(captureState.newBinding, captureState.conflicts)}
          onCancel={cancelCapture}
        />
      )}
    </>
  );
};

// -- Key Capture Overlay ------------------------------------------------------

const KeyCaptureOverlay = forwardRef<HTMLDivElement, { onCancel: () => void }>(({ onCancel }, ref) => (
  <div
    ref={ref}
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onClick={onCancel}
    onKeyDown={(e) => e.stopPropagation()}
  >
    <div
      className="rounded-xl bg-composer-bg-dark border border-composer-border px-8 py-6 text-center shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-lg font-medium text-composer-text mb-2">Press new shortcut</p>
      <p className="text-sm text-composer-text-muted">Press Escape to cancel</p>
    </div>
  </div>
));

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
  const displayKey = newBinding.key === " " ? "Space" : newBinding.key;
  const bindingKeys: string[] = [];
  if (newBinding.shift) bindingKeys.push("Shift");
  if (newBinding.alt) bindingKeys.push("Alt");
  bindingKeys.push(displayKey);

  return (
    <Modal isOpen onClose={onCancel} title="Shortcut conflict">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-composer-text">
          <span className="inline-flex items-center gap-1">
            {bindingKeys.map((key, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: key order is fixed
              <KeyBadge key={`${key}-${i}`} keyName={key} />
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

        <p className="text-xs text-composer-text-muted">
          Replacing will reset the conflicting shortcut to its default.
        </p>

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
