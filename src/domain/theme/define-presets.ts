import { DARK_NEGATIVE, DARK_POSITIVE, LIGHT_NEGATIVE, LIGHT_POSITIVE } from "@/domain/theme/mark-constants";
import type { Scheme, Theme, TokenKey } from "@/domain/theme/model";
import { DARK_ONSET, LIGHT_ONSET } from "@/domain/theme/onset-constants";
import { DARK_SNAP, LIGHT_SNAP } from "@/domain/theme/snap-constants";

// -- Types ---------------------------------------------------------------------

type PresetGroup = "Composer" | "Classics";

type PresetDefinition = Pick<Theme, "id" | "name" | "scheme" | "desc" | "tokens">;

// -- Constants -----------------------------------------------------------------

const SCHEME_SEEDS: Record<Scheme, Partial<Record<TokenKey, string>>> = {
  dark: { positive: DARK_POSITIVE, negative: DARK_NEGATIVE, snap: DARK_SNAP, onset: DARK_ONSET },
  light: { positive: LIGHT_POSITIVE, negative: LIGHT_NEGATIVE, snap: LIGHT_SNAP, onset: LIGHT_ONSET },
};

// -- Definition ----------------------------------------------------------------

function definePresets(group: PresetGroup, presets: PresetDefinition[]): Theme[] {
  return presets.map((preset) => ({
    ...preset,
    kind: "preset",
    group,
    tokens: { ...SCHEME_SEEDS[preset.scheme], ...preset.tokens },
  }));
}

// -- Exports -------------------------------------------------------------------

export { definePresets };
