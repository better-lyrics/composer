import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const FIRST_PAUSE_SEEN_KEY = "composer.syncPauseLaneSeen";
const FIRST_PAUSE_TOAST_DURATION_MS = 10000;

// -- Functions ----------------------------------------------------------------

function showFirstPauseToastOnce(): void {
  if (localStorage.getItem(FIRST_PAUSE_SEEN_KEY)) return;
  localStorage.setItem(FIRST_PAUSE_SEEN_KEY, "true");
  toast("Pausing keeps your place now", {
    description: (
      <>
        Click a word to tap it again. All timings are under Edit{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("sync.toggleEdit")} />.
      </>
    ),
    duration: FIRST_PAUSE_TOAST_DURATION_MS,
  });
}

// -- Exports ------------------------------------------------------------------

export { showFirstPauseToastOnce };
