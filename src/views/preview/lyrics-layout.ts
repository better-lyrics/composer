// -- Types --------------------------------------------------------------------

type LyricsLayout = "page" | "sidebar";

// -- Constants -----------------------------------------------------------------

const LYRICS_ELEMENT_CLASS: Record<LyricsLayout, string> = {
  page: "block flex-1 mx-auto w-full max-w-3xl px-6",
  sidebar: "block flex-1 w-full px-2",
};

// -- Exports -------------------------------------------------------------------

export { LYRICS_ELEMENT_CLASS, type LyricsLayout };
