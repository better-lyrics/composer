import { useEffect } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { overridesAfterSwitch } from "@/stores/shortcut-preset-switch";
import { shouldOfferSpaceHint } from "@/utils/space-habit-hint";
import { isTypingTarget } from "@/utils/typing-target";

// -- State --------------------------------------------------------------------

let spaceAt: number | undefined;
let offered = false;

// -- Toasts -------------------------------------------------------------------

function switchToEditorFromHint(): void {
  const { preset, overrides, setPreset } = useShortcutBindingsStore.getState();
  setPreset("editor", overridesAfterSwitch("editor", overrides, true));
  toast("Space plays now", {
    description: "Want arrows to seek too? Try Remastered.",
    action: { label: "Undo", onClick: () => setPreset(preset, overrides) },
  });
}

function showSpaceHint(): void {
  toast("Want Space to play?", {
    description: "The Editor preset swaps Space and Enter.",
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Use Editor", onClick: switchToEditorFromHint },
    cancel: { label: "Keep Enter", onClick: () => useShortcutBindingsStore.getState().answerSpaceHint() },
  });
}

// -- Helpers ------------------------------------------------------------------

function notePlayShortcut(): void {
  if (offered) return;
  const { preset, overrides, spaceHintAnswered } = useShortcutBindingsStore.getState();
  const offer = shouldOfferSpaceHint({
    preset,
    playOverridden: "global.playPause" in overrides,
    answered: spaceHintAnswered,
    activeTab: useProjectStore.getState().activeTab,
    spaceAt,
    playAt: performance.now(),
  });
  if (!offer) return;
  offered = true;
  showSpaceHint();
}

function noteSpace(event: KeyboardEvent): void {
  const modified = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
  if (event.key !== " " || event.repeat || modified || isTypingTarget(event.target)) return;
  spaceAt = performance.now();
}

// -- Hook ---------------------------------------------------------------------

function useSpaceHabitHint(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", noteSpace, true);
    return () => window.removeEventListener("keydown", noteSpace, true);
  }, [enabled]);
}

// -- Exports ------------------------------------------------------------------

export { notePlayShortcut, useSpaceHabitHint };
