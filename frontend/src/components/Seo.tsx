import { useLocation } from "react-router";

import { brand } from "@/config/brand";

interface SeoProps {
  title?: string;
  description?: string;
  image?: string;
  /** Keep private or thin pages out of search engines. */
  noIndex?: boolean;
}

/** Page metadata. React 19 hoists these tags into <head>. */
export function Seo({ title, description = brand.description, image = brand.assets.socialShare, noIndex }: SeoProps) {
  const { pathname } = useLocation();
  const fullTitle = title ? `${title} · ${brand.name}` : `${brand.name} — ${brand.tagline}`;
  const url = `${brand.siteUrl}${pathname}`;
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </>
  );
}
