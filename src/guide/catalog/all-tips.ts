import { EDIT_TIPS } from "@/guide/catalog/edit";
import { EXPORT_TIPS } from "@/guide/catalog/export";
import { IMPORT_TIPS } from "@/guide/catalog/import";
import { LANGUAGES_TIPS } from "@/guide/catalog/languages";
import { PREVIEW_TIPS } from "@/guide/catalog/preview";
import { SYNC_TIPS } from "@/guide/catalog/sync";
import { TIMELINE_TIPS } from "@/guide/catalog/timeline";
import type { GuideTip } from "@/guide/catalog/types";

// -- Catalog ------------------------------------------------------------------

const ALL_GUIDE_TIPS: readonly GuideTip[] = [
  ...IMPORT_TIPS,
  ...EDIT_TIPS,
  ...LANGUAGES_TIPS,
  ...SYNC_TIPS,
  ...TIMELINE_TIPS,
  ...PREVIEW_TIPS,
  ...EXPORT_TIPS,
];

// -- Exports ------------------------------------------------------------------

export { ALL_GUIDE_TIPS };
