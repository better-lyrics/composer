import {
  assignBinding,
  bindingToKeys,
  detectConflicts,
  getEffectiveKeysArray,
  useShortcutBindingsStore,
} from "@/stores/shortcut-bindings";
import type { ShortcutBinding, ShortcutDefinition } from "@/stores/shortcut-registry";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { INPUT_STYLES } from "@/ui/input-styles";
import { KeyBadge } from "@/ui/shortcut-reference";
import { cn } from "@/utils/cn";
import { focusOnMount } from "@/utils/focus-on-mount";
import { MOD_KEY } from "@/utils/platform";
import {
  bindingFromKeyboardEvent,
  isCommandBinding,
  isReservedBrowserShortcut,
  reportedBinding,
} from "@/utils/shortcut-matcher";
import { useCallback, useEffect, useRef, useState } from "react";
import { HighlightMatches } from "@/ui/highlight-matches";
import { SETTING_ROW_SURFACE } from "@/ui/settings/setting-row-layout";
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
  message: React.ReactNode;
  currentKeys: string[];
  newKeys: string[];
  onKeep: () => void;
  onUse: () => void;
}

// -- Constants ----------------------------------------------------------------

const IDLE: CaptureState = { status: "idle" };

const BINDING_SLOT_BASE = "h-7 -mr-[7px] inline-flex items-center justify-end gap-0.5 rounded-lg border cursor-pointer";

const BINDING_SLOT_IDLE = cn(BINDING_SLOT_BASE, "px-1.5 border-transparent transition-colors hover:bg-(--layer-1)");

const BINDING_SLOT_LISTENING = cn(
  INPUT_STYLES,
  BINDING_SLOT_BASE,
  "py-0 text-[12.5px] text-(--muted) cursor-pointer bg-[color-mix(in_oklab,var(--ink)_6%,var(--well))]",
);

// -- Helpers ------------------------------------------------------------------

function spokenKeys(keys: string[]): string {
  if (keys.length === 0) return "Unbound";
  return keys.map((key) => (key === "Mod" ? MOD_KEY : key)).join("+");
}

// -- Components ---------------------------------------------------------------

const NoticeKeys: React.FC<{ keys: string[] }> = ({ keys }) => (
  <>
    <span aria-hidden="true">
      <InlineKeyBadge keys={keys} className="ml-0" />
    </span>
    <span className="sr-only">{spokenKeys(keys)}</span>
  </>
);

const CaptureMessage: React.FC<{ state: CaptureState; newKeys: string[] }> = ({ state, newKeys }) => {
  if (state.status === "warning") {
    return (
      <>
        <NoticeKeys keys={newKeys} /> may be taken by the browser.
      </>
    );
  }
  if (state.status !== "conflict") return null;
  const owners = state.conflicts.map((conflict) => conflict.description).join(", ");
  return (
    <>
      <NoticeKeys keys={newKeys} /> is already used by {owners}.
    </>
  );
};

const CaptureNotice: React.FC<CaptureNoticeProps> = ({ message, currentKeys, newKeys, onKeep, onUse }) => (
  <div className="flex items-center justify-between gap-3">
    <p role="status" className="min-w-0 text-[12.5px] leading-[1.45] text-(--muted) text-pretty select-text">
      {message}
    </p>
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        aria-label={currentKeys.length === 0 ? "Keep unbound" : `Keep ${spokenKeys(currentKeys)}`}
        onClick={onKeep}
      >
        Keep
        <InlineKeyBadge keys={currentKeys} className="ml-0" />
      </Button>
      <Button
        size="sm"
        variant="secondary"
        aria-label={`Use ${spokenKeys(newKeys)} here`}
        onClick={onUse}
        ref={focusOnMount}
      >
        Use
        <InlineKeyBadge keys={newKeys} className="ml-0" />
        here
      </Button>
    </div>
  </div>
);

const BindingDisplay: React.FC<{ isListening: boolean; needsCommandKey: boolean; keys: string[] }> = ({
  isListening,
  needsCommandKey,
  keys,
}) => {
  if (isListening) return needsCommandKey ? `Press keys with ${MOD_KEY}…` : "Press keys…";
  if (keys.length === 0) return <InlineKeyBadge keys={keys} className="ml-0" />;
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
  const isListening = captureState.status === "listening";

  return (
    <div ref={rowRef}>
      <div className={cn(SETTING_ROW_SURFACE, "flex flex-col gap-1 py-1.5")}>
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm text-composer-text-secondary">
            <HighlightMatches text={definition.description} query={searchQuery} />
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {isOverridden && !isActive && (
              <button
                type="button"
                onClick={() => resetBinding(definition.id)}
                className="text-[12.5px] text-composer-accent-text hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              aria-label={`Change shortcut for ${definition.description}, currently ${spokenKeys(keys)}`}
              aria-pressed={isListening}
              onClick={startCapture}
              onBlur={cancelListening}
              className={isListening ? BINDING_SLOT_LISTENING : BINDING_SLOT_IDLE}
            >
              <BindingDisplay
                isListening={isListening}
                needsCommandKey={definition.needsCommandKey === true}
                keys={shownKeys}
              />
            </button>
          </div>
        </div>

        {(captureState.status === "warning" || captureState.status === "conflict") && (
          <CaptureNotice
            message={<CaptureMessage state={captureState} newKeys={pendingKeys} />}
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
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ShortcutRebindRow };
