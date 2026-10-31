import type { ProjectTab } from "@/domain/project/tab";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { overridesAfterSwitch } from "@/stores/shortcut-preset-switch";
import type { ShortcutScope } from "@/stores/shortcut-registry";
import { shouldOfferSpaceHint } from "@/utils/space-habit-hint";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { isTypingTarget } from "@/utils/typing-target";
import { useEffect } from "react";
import { toast } from "sonner";

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

function answerSpaceHint(): void {
  useShortcutBindingsStore.getState().answerSpaceHint();
}

function showSpaceHint(): void {
  toast("Want Space to play?", {
    description: "Right now Enter plays. The Editor preset swaps them.",
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Use Editor", onClick: switchToEditorFromHint },
    cancel: { label: "Keep Enter", onClick: answerSpaceHint },
    onDismiss: answerSpaceHint,
  });
}

// -- Helpers ------------------------------------------------------------------

const ACTIVATES_ON_SPACE =
  "button, a[href], summary, [role=button], [role=checkbox], [role=switch], [role=radio], [role=tab]";
const TAB_SCOPES: Partial<Record<ProjectTab, ShortcutScope>> = { sync: "sync", timeline: "timeline" };

function spaceDoesSomething(event: KeyboardEvent, activeTab: ProjectTab): boolean {
  if (event.target instanceof Element && event.target.closest(ACTIVATES_ON_SPACE)) return true;
  const tabScope = TAB_SCOPES[activeTab];
  return (
    findMatchingShortcut(event, "global") !== null || (!!tabScope && findMatchingShortcut(event, tabScope) !== null)
  );
}

function offerIfHabit(spaceDidNothing: boolean, playAt?: number): void {
  if (offered) return;
  const { preset, overrides, spaceHintAnswered } = useShortcutBindingsStore.getState();
  const offer = shouldOfferSpaceHint({
    preset,
    playOverridden: "global.playPause" in overrides,
    answered: spaceHintAnswered,
    activeTab: useProjectStore.getState().activeTab,
    hasAudio: useAudioStore.getState().source !== null,
    spaceDidNothing,
    spaceAt,
    playAt,
  });
  if (!offer) return;
  offered = true;
  showSpaceHint();
}

function notePlayShortcut(): void {
  offerIfHabit(false, performance.now());
}

function noteSpace(event: KeyboardEvent): void {
  const modified = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
  if (event.key !== " " || event.repeat || modified || isTypingTarget(event.target)) return;
  spaceAt = performance.now();
  offerIfHabit(!spaceDoesSomething(event, useProjectStore.getState().activeTab));
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
