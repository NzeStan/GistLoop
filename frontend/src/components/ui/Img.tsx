import { type ImgHTMLAttributes, useState } from "react";

interface ImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  /** Shown if `src` is missing or fails to load (e.g. a brand placeholder from brand.ts). */
  fallback?: string;
}

/** Lazy-loaded image that falls back gracefully. Always pass meaningful `alt` text (or "" if decorative). */
export function Img({ src, fallback, alt = "", loading = "lazy", decoding = "async", ...rest }: ImgProps) {
  const [failed, setFailed] = useState(false);
  const source = !src || failed ? fallback : src;
  if (!source) return null;
  return (
    <img
      src={source}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onError={() => {
        if (!failed && fallback && source !== fallback) setFailed(true);
      }}
      {...rest}
    />
  );
}
