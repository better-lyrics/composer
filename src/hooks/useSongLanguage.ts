import { songLanguage } from "@/domain/alignment/language";
import { useProjectStore } from "@/stores/project";
import { useMemo } from "react";

// -- Hooks ---------------------------------------------------------------------

const useSongLanguage = (): string | null => {
  const language = useProjectStore((s) => s.metadata.language);
  const lines = useProjectStore((s) => s.lines);
  return useMemo(() => songLanguage(language, lines), [language, lines]);
};

// -- Exports -------------------------------------------------------------------

export { useSongLanguage };
