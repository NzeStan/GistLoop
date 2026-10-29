import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(#[\p{L}\p{N}_]{1,64})|(@[A-Za-z0-9_]{2,30})/gu;

/**
 * Post and comment text with hashtags, mentions and links made clickable. Builds React elements
 * (never HTML strings), so user text can't inject markup.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const [token, url, tag, mention] = match;
    if (url) {
      parts.push(
        <a key={index} href={url} target="_blank" rel="noopener noreferrer nofollow ugc">
          {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}
          {url.length > 56 ? "…" : ""}
        </a>,
      );
    } else if (tag) {
      parts.push(
        <Link key={index} to={`/tags/${encodeURIComponent(tag.slice(1).toLowerCase())}`}>
          {tag}
        </Link>,
      );
    } else if (mention) {
      parts.push(
        <Link key={index} to={`/u/${mention.slice(1)}`}>
          {mention}
        </Link>,
      );
    } else {
      parts.push(token);
    }
    last = index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <p className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </p>
  );
}
