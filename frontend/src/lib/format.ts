import { brand } from "@/config/brand";

const locale = brand.locale;

/** "₦8,500" from 850000 kobo. Zero-decimal display for whole amounts. */
export function formatMoney(minor: number, currency: string = brand.currency): string {
  const amount = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Compact counts: 1.2K, 3.4M. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "5 min. ago", "yesterday", "in 3 days". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === "minute") return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** "Sat, 31 Oct 2026" */
export function formatDate(iso: string, timeZone: string = brand.timeZone): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

/** "11:00 am" */
export function formatTime(iso: string, timeZone: string = brand.timeZone): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** "Sat, 31 Oct · 11:00 am – 2:00 pm" (same day) or a full range across days. */
export function formatRange(startIso: string, endIso: string, timeZone: string = brand.timeZone): string {
  const sameDay = formatDate(startIso, timeZone) === formatDate(endIso, timeZone);
  if (sameDay)
    return `${formatDate(startIso, timeZone)} · ${formatTime(startIso, timeZone)} – ${formatTime(endIso, timeZone)}`;
  return `${formatDate(startIso, timeZone)} ${formatTime(startIso, timeZone)} – ${formatDate(endIso, timeZone)} ${formatTime(endIso, timeZone)}`;
}

/** Full timestamp for tooltips and <time> titles. */
export function formatDateTime(iso: string, timeZone: string = brand.timeZone): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

const LABELS: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
  like_new: "Like new",
  used: "Used",
  new: "New",
  for_parts: "For parts",
  not_applicable: "N/A",
};

export const humanize = (value: string) =>
  LABELS[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
