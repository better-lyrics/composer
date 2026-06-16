import { create } from "zustand";
import { persist } from "zustand/middleware";
import { decodeThemeCode } from "@/domain/theme/code";
import { deriveTheme } from "@/domain/theme/derive";
import type { Theme, ThemeId } from "@/domain/theme/model";
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from "@/domain/theme/presets";
import { applyResolvedTheme } from "@/utils/theme/apply";

// -- Types --------------------------------------------------------------------

interface ThemeState {
  activeThemeId: ThemeId;
  customThemes: Theme[];
}

interface ThemeActions {
  getThemeById: (id: ThemeId) => Theme | undefined;
  setActiveTheme: (id: ThemeId) => void;
  addCustomTheme: (theme: Theme) => void;
  updateCustomTheme: (id: ThemeId, patch: Partial<Theme>) => void;
  deleteCustomTheme: (id: ThemeId) => void;
  importThemeCode: (code: string, makeId?: () => string) => Theme;
}

// -- Defaults -----------------------------------------------------------------

const INITIAL_STATE: ThemeState = {
  activeThemeId: DEFAULT_PRESET_ID,
  customThemes: [],
};

function makeRandomId(): string {
  return crypto.randomUUID();
}

function applyTheme(theme: Theme): void {
  applyResolvedTheme(deriveTheme(theme), theme.scheme);
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
        set((state) => ({ customThemes: state.customThemes.filter((t) => t.id !== id) }));
        if (wasActive) get().setActiveTheme(DEFAULT_PRESET_ID);
      },

      importThemeCode: (code, makeId) => {
        const theme = decodeThemeCode(code, makeId ?? makeRandomId);
        set((state) => ({ customThemes: [...state.customThemes, theme] }));
        return theme;
      },
    }),
    {
      name: "composer-theme",
      version: 1,
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
export type { ThemeState };
