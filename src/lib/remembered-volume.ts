import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

// -- Constants ----------------------------------------------------------------

const WRITE_DELAY_MS = 500;

// -- Watching -----------------------------------------------------------------

function watchRememberedVolume(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = useAudioStore.subscribe((state, previous) => {
    if (state.volume === previous.volume) return;
    if (!useSettingsStore.getState().rememberVolume) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      useSettingsStore.getState().set("lastVolume", state.volume);
    }, WRITE_DELAY_MS);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

// -- Exports ------------------------------------------------------------------

export { watchRememberedVolume };
