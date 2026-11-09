import { keys } from "@/guide/catalog/keys";
import { stageTip } from "@/guide/catalog/types";
import { IconAbc, IconClipboardText, IconEye, IconLanguage } from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("languages");

const LANGUAGES_TIPS = [
  tip({ id: "generate", tier: "basics", icon: IconLanguage, title: "Add a translation", gist: <>Pick a language and generate it line by line.</> }),
  tip({ id: "romanize", tier: "basics", icon: IconAbc, title: "Add romanization", gist: <>For non-Latin lyrics, generate how each line sounds.</> }),
  tip({ id: "paste", tier: "further", icon: IconClipboardText, title: "Paste your own translation", gist: <>Paste your lines and match them to the lyrics.</> }),
  tip({ id: "showWhileSyncing", tier: "further", icon: IconEye, title: "Read romanization while you sync", gist: <>Press {keys("sync.toggleTextVariant")} in Sync to swap what you read.</> }),
];

// -- Exports ------------------------------------------------------------------

export { LANGUAGES_TIPS };
