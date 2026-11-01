import { SITE_ORIGIN } from "@/seo/schemas";

interface IndexingTags {
  canonical?: string;
  robots?: "noindex";
}

function indexingTags(path: string, noindex: boolean): IndexingTags {
  return noindex ? { robots: "noindex" } : { canonical: `${SITE_ORIGIN}${path}` };
}

export { indexingTags };
