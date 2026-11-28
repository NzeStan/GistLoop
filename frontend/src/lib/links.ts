/** Where a piece of content lives on the website, from its University content type and id. */
export function contentHref(type: string, id: string): string | null {
  switch (type) {
    case "social.post":
      return `/posts/${id}`;
    case "social.comment":
      return null;
    case "community.community":
      return `/c/${id}`;
    case "events.event":
      return `/events/id/${id}`;
    case "marketplace.listing":
      return `/marketplace/${id}`;
    case "podcast.show":
      return `/podcasts/id/${id}`;
    case "podcast.episode":
      return `/podcasts/episode/${id}`;
    case "anonymous.post":
      return `/gist/p/${id}`;
    case "institution.institution":
      return `/schools/${id}`;
    case "institution.announcement":
      return "/announcements";
    case "opportunities.opportunity":
      return `/opportunities/${id}`;
    case "creator.campaign":
      return `/sponsorships/${id}`;
    case "promotions.campaign":
      return `/promote/${id}`;
    case "messaging.message":
      return "/messages";
    case "anonymous.message":
      return "/inbox";
    case "users.user":
      return null;
    default:
      return null;
  }
}

export const CONTENT_LABELS: Record<string, string> = {
  "social.post": "Post",
  "community.community": "Community",
  "events.event": "Event",
  "marketplace.listing": "Listing",
  "podcast.show": "Podcast",
  "podcast.episode": "Episode",
  "anonymous.post": "Gist",
  "creator.campaign": "Sponsorship",
  "social.comment": "Comment",
  "anonymous.comment": "Gist reply",
  "anonymous.message": "Inbox message",
  "messaging.message": "Message",
  "opportunities.opportunity": "Opportunity",
  "institution.institution": "School",
  "institution.announcement": "Announcement",
  "promotions.campaign": "Advert",
  "marketplace.review": "Review",
  "users.user": "Account",
};

/** User-supplied links: only http(s) is allowed (never javascript:, data: and the like). */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
