// -- Built-in presets ----------------------------------------------------------
// Assembles the Composer + classic preset lists into the public registry. Raw
// seed data lives in composer-presets.ts and classic-presets.ts; this module
// owns the lookup structures.

import type { Theme, ThemeId } from "@/domain/theme/model";
import { CLASSIC_PRESETS } from "@/domain/theme/classic-presets";
import { COMPOSER_PRESETS } from "@/domain/theme/composer-presets";

const PRESETS: Theme[] = [...COMPOSER_PRESETS, ...CLASSIC_PRESETS];

const DEFAULT_PRESET_ID = "default";

const PRESET_BY_ID: Map<ThemeId, Theme> = new Map(PRESETS.map((preset) => [preset.id, preset]));

export { PRESETS, PRESET_BY_ID, DEFAULT_PRESET_ID };
