import type { ReactNode } from "react";
import { create } from "zustand";
import { type SettingsState, useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

type SettingsBoolKey = {
  [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never;
}[keyof SettingsState];

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  settingsKey?: SettingsBoolKey;
  recoverable?: boolean;
}

interface ConfirmStore {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  resolveAndClose: (value: boolean, dontAskAgain: boolean) => void;
}

// -- Store --------------------------------------------------------------------

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  options: null,
  resolve: null,

  open: (options) => {
    if (options.settingsKey && useSettingsStore.getState()[options.settingsKey] === false) {
      return Promise.resolve(true);
    }
    if (get().isOpen) {
      console.warn("[Composer] confirm() called while a modal is already open; auto-cancelling the second call");
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, options, resolve });
    });
  },

  resolveAndClose: (value, dontAskAgain) => {
    const { options, resolve } = get();
    if (value && dontAskAgain && options?.settingsKey) {
      useSettingsStore.getState().set(options.settingsKey, false);
    }
    resolve?.(value);
    set({ isOpen: false, options: null, resolve: null });
  },
}));

function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useConfirmStore.getState().open;
}

// -- Exports ------------------------------------------------------------------

export { useConfirm, useConfirmStore };
export type { ConfirmOptions };
