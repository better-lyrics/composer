import { CLASSIC_DARK_PRESETS_A_M } from "@/domain/theme/classic-dark-presets-a-m";
import { CLASSIC_DARK_PRESETS_N_Z } from "@/domain/theme/classic-dark-presets-n-z";
import { CLASSIC_LIGHT_PRESETS } from "@/domain/theme/classic-light-presets";
import { COMPOSER_DARK_PRESETS } from "@/domain/theme/composer-dark-presets";
import { COMPOSER_LIGHT_PRESETS } from "@/domain/theme/composer-light-presets";
import type { Theme, ThemeId } from "@/domain/theme/model";

// -- Built-in presets ----------------------------------------------------------

const DEFINED_PRESETS: Theme[] = [
  ...COMPOSER_DARK_PRESETS,
  ...COMPOSER_LIGHT_PRESETS,
  ...CLASSIC_DARK_PRESETS_A_M,
  ...CLASSIC_DARK_PRESETS_N_Z,
  ...CLASSIC_LIGHT_PRESETS,
];

const PRESET_BY_ID: Map<ThemeId, Theme> = new Map(DEFINED_PRESETS.map((preset) => [preset.id, preset]));

const GALLERY_ORDER: ThemeId[] = [
  "default",
  "studio",
  "vinyl",
  "volt",
  "sunset",
  "sakura",
  "daylight",
  "high-contrast",
  "harbor",
  "moss",
  "rosewater",
  "graphite",
  "ember",
  "tide",
  "light",
  "github-dark",
  "ayu-mirage",
  "monokai-pro",
  "poimandres",
  "vesper",
  "oxocarbon",
  "flexoki-dark",
  "cobalt2",
  "synthwave",
  "horizon",
  "catppuccin-latte",
  "flexoki-light",
  "dracula",
  "nord",
  "solarized-dark",
  "solarized-light",
  "gruvbox",
  "tokyo-night",
  "catppuccin",
  "rose-pine",
  "one-dark",
];

const PRESETS: Theme[] = GALLERY_ORDER.flatMap((id) => PRESET_BY_ID.get(id) ?? []);

const DEFAULT_PRESET_ID = "default";

// -- Exports -------------------------------------------------------------------

export { PRESETS, PRESET_BY_ID, DEFAULT_PRESET_ID };
