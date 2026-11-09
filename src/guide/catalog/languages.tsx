import { keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
import { IconAbc, IconClipboardText, IconEye, IconLanguage } from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("languages");

const LANGUAGES_TIPS = [
  tip({
    id: "generate",
    tier: "basics",
    icon: IconLanguage,
    title: "Add a translation",
    gist: <>Pick a language under Add language and every line gets translated.</>,
  }),
  tip({
    id: "romanize",
    tier: "basics",
    icon: IconAbc,
    title: "Add a transliteration",
    gist: <>For non-Latin lyrics, generate how each line sounds in Latin letters.</>,
  }),
  tip({
    id: "paste",
    tier: "further",
    icon: IconClipboardText,
    title: "Paste your own translation",
    gist: <>Paste four or more lines and match them to your lyrics.</>,
  }),
  tip({
    id: "showWhileSyncing",
    tier: "further",
    icon: IconEye,
    title: "Read the transliteration while you sync",
    gist: <>Press {keys("sync.toggleTextVariant")} in Sync to switch between Original and Transliteration.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { LANGUAGES_TIPS };
