// -- Types --------------------------------------------------------------------

type LyricsLayout = "page" | "sidebar";

// -- Constants -----------------------------------------------------------------

const LYRICS_ELEMENT_CLASS: Record<LyricsLayout, string> = {
  page: "block flex-1 mx-auto w-full max-w-3xl px-6",
  sidebar: "block flex-1 w-full px-2",
};

const OUTSIDE_FOCUS_ATTRIBUTE = "data-outside-focus";

// -- Exports -------------------------------------------------------------------

export { LYRICS_ELEMENT_CLASS, OUTSIDE_FOCUS_ATTRIBUTE, type LyricsLayout };
