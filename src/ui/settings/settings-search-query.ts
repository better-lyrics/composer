import { createContext, useContext } from "react";

// -- Context -------------------------------------------------------------------

const SettingsSearchQueryContext = createContext("");

function useSettingsSearchQuery(): string {
  return useContext(SettingsSearchQueryContext);
}

// -- Exports -------------------------------------------------------------------

export { SettingsSearchQueryContext, useSettingsSearchQuery };
