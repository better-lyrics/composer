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
import { cn } from "@/utils/cn";
import { MOD_KEY } from "@/utils/platform";
import {
  bindingFromKeyboardEvent,
  isCommandBinding,
  isReservedBrowserShortcut,
  reportedBinding,
} from "@/utils/shortcut-matcher";
import { useCallback, useEffect, useRef, useState } from "react";
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

interface CaptureNoticeProps {
  message: string;
  currentKeys: string[];
  newKeys: string[];
  onKeep: () => void;
  onUse: () => void;
}

// -- Constants ----------------------------------------------------------------

const IDLE: CaptureState = { status: "idle" };

// -- Helpers ------------------------------------------------------------------

function spokenKeys(keys: string[]): string {
  if (keys.length === 0) return "Unbound";
  return keys.map((key) => (key === "Mod" ? MOD_KEY : key)).join("+");
}

function captureMessage(state: CaptureState, newKeys: string[]): string {
  if (state.status === "warning") return `${spokenKeys(newKeys)} may be taken by the browser.`;
  if (state.status === "conflict") {
    const owners = state.conflicts.map((conflict) => conflict.description).join(", ");
    return `${spokenKeys(newKeys)} is already used by ${owners}.`;
  }
  return "";
}

// -- Components ---------------------------------------------------------------

const CaptureNotice: React.FC<CaptureNoticeProps> = ({ message, currentKeys, newKeys, onKeep, onUse }) => (
  <div className="flex items-center justify-between gap-3 text-[12.5px] text-(--muted)">
    <span role="status" className="select-text">
      {message}
    </span>
    <span className="flex shrink-0 gap-1.5">
      <Button size="sm" variant="ghost" onClick={onKeep}>
        {currentKeys.length === 0 ? "Keep unbound" : `Keep ${spokenKeys(currentKeys)}`}
      </Button>
      <Button size="sm" variant="secondary" onClick={onUse}>
        {`Use ${spokenKeys(newKeys)} here`}
      </Button>
    </span>
  </div>
);

const BindingDisplay: React.FC<{ isListening: boolean; needsCommandKey: boolean; keys: string[] }> = ({
  isListening,
  needsCommandKey,
  keys,
}) => {
  if (isListening) {
    return (
      <span className="h-7 px-2.5 grid place-items-center rounded-md bg-(--well) text-[12.5px] text-(--muted)">
        {needsCommandKey ? `Press keys with ${MOD_KEY}…` : "Press keys…"}
      </span>
    );
  }
  if (keys.length === 0) return <span className="text-xs text-composer-text-muted italic">Unbound</span>;
  return keys.map((key) => <KeyBadge key={key} keyName={key} />);
};

const ShortcutRebindRow: React.FC<ShortcutRebindRowProps> = ({ definition }) => {
  const searchQuery = useSettingsSearchQuery();
  const [captureState, setCaptureState] = useState<CaptureState>(IDLE);
  const rowRef = useRef<HTMLDivElement>(null);
  const pressedAsRef = useRef<ShortcutBinding | undefined>(undefined);
  const resetBinding = useShortcutBindingsStore((s) => s.resetBinding);
  const overrides = useShortcutBindingsStore((s) => s.overrides);
  const isOverridden = definition.id in overrides;

  const keys = getEffectiveKeysArray(definition.id);
  const pendingKeys =
    captureState.status === "warning" || captureState.status === "conflict"
      ? bindingToKeys(captureState.newBinding)
      : [];
  const shownKeys = pendingKeys.length > 0 ? pendingKeys : keys;

  const startCapture = useCallback(() => setCaptureState({ status: "listening" }), []);
  const cancelCapture = useCallback(() => setCaptureState(IDLE), []);
  const cancelListening = useCallback(
    () => setCaptureState((state) => (state.status === "listening" ? IDLE : state)),
    [],
  );

  const replaceConflicts = useCallback(
    (binding: ShortcutBinding) => {
      assignBinding(definition.id, binding, pressedAsRef.current);
      setCaptureState(IDLE);
    },
    [definition.id],
  );

  const applyCapturedBinding = useCallback(
    (binding: ShortcutBinding) => {
      const conflicts = detectConflicts(definition.id, binding, pressedAsRef.current);
      if (conflicts.length > 0) {
        setCaptureState({ status: "conflict", newBinding: binding, conflicts });
      } else {
        assignBinding(definition.id, binding, pressedAsRef.current);
        setCaptureState(IDLE);
      }
    },
    [definition.id],
  );

  useEffect(() => {
    if (captureState.status === "idle") return;
    const isListening = captureState.status === "listening";

    // Window capture runs before every app key handler and the Settings Escape layer, so recorded keys reach nothing else.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isListening && e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        cancelCapture();
        return;
      }

      const newBinding = bindingFromKeyboardEvent(e);
      if (!newBinding) return;
      if (definition.needsCommandKey && !isCommandBinding(newBinding)) return;
      pressedAsRef.current = reportedBinding(e, newBinding);

      if (isReservedBrowserShortcut(newBinding)) {
        setCaptureState({ status: "warning", newBinding });
        return;
      }

      applyCapturedBinding(newBinding);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rowRef.current?.contains(e.target)) return;
      cancelCapture();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [captureState.status, cancelCapture, applyCapturedBinding, definition.needsCommandKey]);

  const isActive = captureState.status !== "idle";

  return (
    <div
      ref={rowRef}
      className={cn("flex flex-col gap-1.5 -mx-3 px-3 py-2.5 rounded-lg", isActive && "bg-(--layer-1)")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-composer-text-secondary">
          <HighlightMatches text={definition.description} query={searchQuery} />
        </span>
        <div className="flex items-center gap-2">
          {isOverridden && !isActive && (
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
            aria-pressed={captureState.status === "listening"}
            onClick={startCapture}
            onBlur={cancelListening}
            className="flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors hover:bg-composer-button/50"
          >
            <BindingDisplay
              isListening={captureState.status === "listening"}
              needsCommandKey={definition.needsCommandKey === true}
              keys={shownKeys}
            />
          </button>
        </div>
      </div>

      {(captureState.status === "warning" || captureState.status === "conflict") && (
        <CaptureNotice
          message={captureMessage(captureState, pendingKeys)}
          currentKeys={keys}
          newKeys={pendingKeys}
          onKeep={cancelCapture}
          onUse={() =>
            captureState.status === "warning"
              ? applyCapturedBinding(captureState.newBinding)
              : replaceConflicts(captureState.newBinding)
          }
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ShortcutRebindRow };
