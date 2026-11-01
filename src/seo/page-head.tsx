import { AnalyticsScripts } from "@/seo/analytics";
import { indexingTags } from "@/seo/indexing-tags";
import { SITE_ORIGIN } from "@/seo/schemas";
import { Head } from "vite-react-ssg";

interface PageHeadProps {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  jsonLd?: object | object[];
  noindex?: boolean;
}

const DEFAULT_OG_IMAGE = "/og-image.png";

const PageHead: React.FC<PageHeadProps> = ({ title, description, path, ogImage, jsonLd, noindex = false }) => {
  const { canonical, robots } = indexingTags(path, noindex);
  const image = `${SITE_ORIGIN}${ogImage ?? DEFAULT_OG_IMAGE}`;
  const structured = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <AnalyticsScripts />
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {robots && <meta name="robots" content={robots} />}
        {canonical && <link rel="canonical" href={canonical} />}
        <meta property="og:type" content="website" />
        {canonical && <meta property="og:url" content={canonical} />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Composer" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={image} />
        {structured.map((schema) => {
          const json = JSON.stringify(schema);
          return (
            <script key={json} type="application/ld+json">
              {json}
            </script>
          );
        })}
      </Head>
    </>
  );
};

export { PageHead };
