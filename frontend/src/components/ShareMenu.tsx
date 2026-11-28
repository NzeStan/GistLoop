import { Link2, Share2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { brand } from "@/config/brand";

import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";
import styles from "./ShareMenu.module.css";

/** Share links for each network (they open the network's own share screen; nothing is posted for you). */
function shareTargets(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    // wa.me opens the WhatsApp app on phones and WhatsApp Web on computers.
    {
      key: "whatsapp",
      label: "WhatsApp",
      color: "#25D366",
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
    { key: "x", label: "X (Twitter)", color: "#111111", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { key: "facebook", label: "Facebook", color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: "telegram", label: "Telegram", color: "#229ED9", href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];
}

/**
 * "Share": the phone's own share sheet where there is one (WhatsApp, Instagram, TikTok… whatever is
 * installed), plus direct WhatsApp, X, Facebook and Telegram links and copy-link.
 */
export function ShareMenu({
  title,
  path,
  text,
  variant = "secondary",
  compact = false,
}: {
  title: string;
  /** Site path, e.g. /posts/123. */
  path: string;
  text?: string;
  variant?: "secondary" | "ghost";
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const toast = useToast();
  const url = new URL(path, window.location.origin).href;
  const message = text ?? `${title} on ${brand.name}`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      // Closed the share sheet: nothing to do.
    }
    setOpen(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <Button
        variant={variant}
        size={compact ? "sm" : "md"}
        icon={compact}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={compact ? "Share" : undefined}
        leading={compact ? undefined : <Share2 size={16} />}
        onClick={() => setOpen((v) => !v)}
      >
        {compact ? <Share2 size={16} aria-hidden /> : "Share"}
      </Button>
      {open && (
        <div id={menuId} role="menu" className={styles.menu}>
          {typeof navigator.share === "function" && (
            <button type="button" role="menuitem" className={styles.item} onClick={() => void nativeShare()}>
              <Share2 size={16} aria-hidden /> Share to an app…
            </button>
          )}
          {shareTargets(url, message).map((t) => (
            <a
              key={t.key}
              role="menuitem"
              className={styles.item}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              <span className={styles.dot} style={{ background: t.color }} aria-hidden /> {t.label}
            </a>
          ))}
          <button type="button" role="menuitem" className={styles.item} onClick={() => void copy()}>
            <Link2 size={16} aria-hidden /> Copy link
          </button>
        </div>
      )}
    </div>
  );
}
