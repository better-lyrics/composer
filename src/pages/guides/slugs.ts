// -- Guide slugs ---------------------------------------------------------------
// The single owner of which guides exist. The router prerenders exactly this
// list, so a slug missing here ships as a client-only route that 404s on a cold
// visit. Kept free of component imports so the router can read it without
// pulling guide content into the entry bundle.

const GUIDE_SLUGS = [
  "what-is-ttml",
  "ttml-vs-lrc",
  "ttml-file-format-spec",
  "how-to-make-apple-music-synced-lyrics",
  "karaoke-style-lyrics-guide",
  "background-vocals-in-ttml",
  "multi-agent-lyrics-duets",
  "lrc-to-ttml-conversion-guide",
  "lyric-best-practices",
] as const;

type GuideSlug = (typeof GUIDE_SLUGS)[number];

export { GUIDE_SLUGS };
export type { GuideSlug };
