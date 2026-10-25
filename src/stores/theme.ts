import { decodeThemeCode } from "@/domain/theme/code";
import { deriveTheme } from "@/domain/theme/derive";
import { DARK_NEGATIVE, DARK_POSITIVE, LIGHT_NEGATIVE, LIGHT_POSITIVE } from "@/domain/theme/mark-constants";
import type { Theme, ThemeId } from "@/domain/theme/model";
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from "@/domain/theme/presets";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// -- Types --------------------------------------------------------------------

interface ThemeState {
  activeThemeId: ThemeId;
  customThemes: Theme[];
  favoriteThemeIds: ThemeId[];
}

interface ThemeActions {
  getThemeById: (id: ThemeId) => Theme | undefined;
  setActiveTheme: (id: ThemeId) => void;
  addCustomTheme: (theme: Theme) => void;
  updateCustomTheme: (id: ThemeId, patch: Partial<Theme>) => void;
  deleteCustomTheme: (id: ThemeId) => void;
  toggleFavoriteTheme: (id: ThemeId) => void;
  importThemeCode: (code: string, makeId?: () => string) => Theme;
}

// -- Defaults -----------------------------------------------------------------

const INITIAL_STATE: ThemeState = {
  activeThemeId: DEFAULT_PRESET_ID,
  customThemes: [],
  favoriteThemeIds: [],
};

function makeRandomId(): string {
  return crypto.randomUUID();
}

function applyTheme(theme: Theme): void {
  applyResolvedTheme(deriveTheme(theme), theme.scheme);
}

// -- Migration ----------------------------------------------------------------

const THEME_PERSIST_VERSION = 3;

const MARK_DEFAULTS = {
  dark: { positive: DARK_POSITIVE, negative: DARK_NEGATIVE },
  light: { positive: LIGHT_POSITIVE, negative: LIGHT_NEGATIVE },
};

// v2 added the positive/negative seeds. Themes saved before then have no value
// for either, and deriveTheme resolves a missing seed to magenta.
function withMarkSeeds(state: Partial<ThemeState>): Partial<ThemeState> {
  if (!Array.isArray(state.customThemes)) return state;
  return {
    ...state,
    customThemes: state.customThemes.map((theme) => ({
      ...theme,
      tokens: { ...MARK_DEFAULTS[theme.scheme === "light" ? "light" : "dark"], ...theme.tokens },
    })),
  };
}

// v3 added favorites, which pick the header theme menu. Existing users keep the
// theme they use and Default in it; new users start with none.
function withStarterFavorites(state: Partial<ThemeState>): Partial<ThemeState> {
  if (Array.isArray(state.favoriteThemeIds)) return state;
  const activeThemeId = state.activeThemeId ?? DEFAULT_PRESET_ID;
  const favoriteThemeIds =
    activeThemeId === DEFAULT_PRESET_ID ? [DEFAULT_PRESET_ID] : [activeThemeId, DEFAULT_PRESET_ID];
  return { ...state, favoriteThemeIds };
}

function migrateTheme(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== "object") return persistedState;
  let state = persistedState as Partial<ThemeState>;
  if (version < 2) state = withMarkSeeds(state);
  if (version < 3) state = withStarterFavorites(state);
  return state;
}

// -- Store --------------------------------------------------------------------

const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      getThemeById: (id) => PRESET_BY_ID.get(id) ?? get().customThemes.find((t) => t.id === id),

      setActiveTheme: (id) => {
        const theme = get().getThemeById(id);
        if (theme) {
          applyTheme(theme);
          set({ activeThemeId: id });
          return;
        }
        const fallback = PRESET_BY_ID.get(DEFAULT_PRESET_ID);
        if (fallback) applyTheme(fallback);
        set({ activeThemeId: DEFAULT_PRESET_ID });
      },

      addCustomTheme: (theme) => set((state) => ({ customThemes: [...state.customThemes, theme] })),

      updateCustomTheme: (id, patch) => {
        const target = get().customThemes.find((t) => t.id === id);
        if (!target) return;
        const merged = { ...target, ...patch };
        if (get().activeThemeId === id) applyTheme(merged);
        set((state) => ({ customThemes: state.customThemes.map((t) => (t.id === id ? merged : t)) }));
      },

      deleteCustomTheme: (id) => {
        const wasActive = get().activeThemeId === id;
        set((state) => ({
          customThemes: state.customThemes.filter((t) => t.id !== id),
          favoriteThemeIds: state.favoriteThemeIds.filter((favoriteId) => favoriteId !== id),
        }));
        if (wasActive) get().setActiveTheme(DEFAULT_PRESET_ID);
      },

      toggleFavoriteTheme: (id) =>
        set((state) => ({
          favoriteThemeIds: state.favoriteThemeIds.includes(id)
            ? state.favoriteThemeIds.filter((favoriteId) => favoriteId !== id)
            : [...state.favoriteThemeIds, id],
        })),

      importThemeCode: (code, makeId) => {
        const theme = decodeThemeCode(code, makeId ?? makeRandomId);
        set((state) => ({ customThemes: [...state.customThemes, theme] }));
        return theme;
      },
    }),
    {
      name: "composer-theme",
      version: THEME_PERSIST_VERSION,
      migrate: migrateTheme,
      onRehydrateStorage: () => (state) => {
        if (state) state.setActiveTheme(state.activeThemeId);
      },
    },
  ),
);

function initTheme(): void {
  const state = useThemeStore.getState();
  state.setActiveTheme(state.activeThemeId);
}

// -- Exports ------------------------------------------------------------------

export { useThemeStore, initTheme, INITIAL_STATE };
