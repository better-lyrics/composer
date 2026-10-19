import { createLanguageAutoRefresh } from "@/lib/language-auto-refresh";
import { useProjectStore } from "@/stores/project";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const REFRESH_DELAY_MS = 1000;

// -- Hook ---------------------------------------------------------------------

function useLanguageAutoRefresh(): void {
  useEffect(() => {
    const refresher = createLanguageAutoRefresh({ delayMs: REFRESH_DELAY_MS });
    refresher.schedule();
    const unsubscribe = useProjectStore.subscribe((state, previous) => {
      if (state.lines !== previous.lines) refresher.schedule();
    });
    return () => {
      unsubscribe();
      refresher.dispose();
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLanguageAutoRefresh };
