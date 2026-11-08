// -- Types ---------------------------------------------------------------------

interface UnisonSettings {
  unisonEnabled: boolean;
  unisonLibraryColumn: boolean;
  unisonLibraryNotices: boolean;
  unisonWantedShelf: boolean;
}

interface UnisonFeatures {
  enabled: boolean;
  libraryColumn: boolean;
  libraryNotices: boolean;
  wantedShelf: boolean;
}

// -- Defaults ------------------------------------------------------------------

const UNISON_SETTING_DEFAULTS: UnisonSettings = {
  unisonEnabled: true,
  unisonLibraryColumn: true,
  unisonLibraryNotices: true,
  unisonWantedShelf: true,
};

// -- Functions -----------------------------------------------------------------

// Turning Unison off hides every part of it without changing the parts' own choices.
function unisonFeatures(settings: UnisonSettings): UnisonFeatures {
  const enabled = settings.unisonEnabled;
  return {
    enabled,
    libraryColumn: enabled && settings.unisonLibraryColumn,
    libraryNotices: enabled && settings.unisonLibraryNotices,
    wantedShelf: enabled && settings.unisonWantedShelf,
  };
}

// -- Exports -------------------------------------------------------------------

export { UNISON_SETTING_DEFAULTS, unisonFeatures };
export type { UnisonFeatures, UnisonSettings };
