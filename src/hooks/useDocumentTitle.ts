import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import type { AppScreen } from "@/utils/app-routes";

// -- Constants ----------------------------------------------------------------

const BRAND = "Composer";
const SEPARATOR = "・";

// -- Hook ---------------------------------------------------------------------

function useDocumentTitle(screen: AppScreen = "editor"): void {
  const songTitle = useProjectStore((s) => s.metadata.title);
  const baseTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (baseTitleRef.current === null) baseTitleRef.current = document.title;
    if (screen === "library") {
      document.title = `${BRAND} ${SEPARATOR} Projects`;
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
