import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import type { AppScreen } from "@/utils/app-routes";

// -- Constants ----------------------------------------------------------------

const BRAND = "Composer";
const SEPARATOR = "・";
const SCREEN_TITLES: Record<Exclude<AppScreen, "editor">, string> = { library: "Projects", unison: "Unison" };

// -- Hook ---------------------------------------------------------------------

function useDocumentTitle(screen: AppScreen = "editor"): void {
  const songTitle = useProjectStore((s) => s.metadata.title);
  const baseTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (baseTitleRef.current === null) baseTitleRef.current = document.title;
    if (screen !== "editor") {
      document.title = `${BRAND} ${SEPARATOR} ${SCREEN_TITLES[screen]}`;
      return;
    }
    const trimmed = songTitle.trim();
    document.title = trimmed ? `${BRAND} ${SEPARATOR} ${trimmed}` : baseTitleRef.current;
  }, [songTitle, screen]);

  useEffect(() => {
    return () => {
      if (baseTitleRef.current !== null) document.title = baseTitleRef.current;
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useDocumentTitle };
