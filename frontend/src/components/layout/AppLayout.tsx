import {
  Bell,
  Bookmark,
  Briefcase,
  CalendarDays,
  Crown,
  Home,
  Inbox,
  LogOut,
  Megaphone,
  MessageCircleQuestion,
  MessagesSquare,
  Mic,
  Search,
  Settings,
  ShoppingBag,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { type FormEvent, Suspense, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { useNotificationCounts } from "@/api/queries/discovery";
import { useMessagingUnread } from "@/api/queries/messaging";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/Spinner";
import { TrendingRail } from "@/features/discovery/TrendingRail";

import styles from "./AppLayout.module.css";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/feed", label: "Home", icon: Home },
  { to: "/messages", label: "Messages", icon: MessagesSquare },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/gist", label: "Anonymous gist", icon: MessageCircleQuestion },
  { to: "/inbox", label: "Anonymous inbox", icon: Inbox },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/opportunities", label: "Opportunities", icon: Briefcase },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/podcasts", label: "Podcasts", icon: Mic },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/promote", label: "Promote", icon: TrendingUp },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/settings", label: "Settings", icon: Settings },
];

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className={styles.badge} aria-label={`${count} unread`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function AccountMenu() {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  return (
    <div className={styles.account} ref={ref}>
      <button
        type="button"
        className={styles.accountButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={me?.display_name} seed={me?.id} src={me?.avatar_url} size="sm" />
        <span className="visually-hidden">Account menu</span>
      </button>
      {open && (
        <div id={menuId} role="menu" className={styles.menu}>
          <div className={styles.menuHeader}>
            <strong>{me?.display_name}</strong>
            {me?.handle && <span className="muted">@{me.handle}</span>}
          </div>
          {me?.handle && (
            <Link role="menuitem" to={`/u/${me.handle}`} className={styles.menuItem} onClick={() => setOpen(false)}>
              <User size={16} aria-hidden /> Your profile
            </Link>
          )}
          {NAV.filter(({ to }) => to !== "/feed").map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              role="menuitem"
              to={to}
              className={to === "/settings" ? styles.menuItem : `${styles.menuItem} ${styles.menuMobileOnly}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={16} aria-hidden /> {label}
            </Link>
          ))}
          <button
            role="menuitem"
            type="button"
            className={styles.menuItem}
            onClick={async () => {
              setOpen(false);
              await signOut();
              navigate("/", { replace: true });
            }}
          >
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <form role="search" className={styles.search} onSubmit={onSubmit}>
      <Search size={18} aria-hidden className={styles.searchIcon} />
      <label htmlFor="app-search" className="visually-hidden">
        Search GistLoop
      </label>
      <input
        id="app-search"
        type="search"
        placeholder="Search posts, communities, events…"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        maxLength={100}
      />
    </form>
  );
}

/** The signed-in experience: header, sidebar (desktop), bottom tabs (mobile) and a trending rail. */
export function AppLayout() {
  const { me, status } = useAuth();
  const counts = useNotificationCounts(status === "signed-in");
  const unread = counts.data?.unread ?? 0;
  const messaging = useMessagingUnread(status === "signed-in");
  const unreadMessages = (messaging.data?.conversations ?? 0) + (messaging.data?.requests ?? 0);
  const badges: Record<string, number> = { "/notifications": unread, "/messages": unreadMessages };
  const profilePath = me?.handle ? `/u/${me.handle}` : "/settings";

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo to="/feed" />
          <HeaderSearch />
          <div className={styles.headerActions}>
            <ButtonLink to="/search" variant="ghost" icon className={styles.mobileSearch} aria-label="Search">
              <Search size={20} aria-hidden />
            </ButtonLink>
            <ThemeToggle />
            <Link
              to="/messages"
              className={styles.bell}
              aria-label={`Messages${unreadMessages ? `, ${unreadMessages} unread` : ""}`}
            >
              <MessagesSquare size={20} aria-hidden />
              <UnreadBadge count={unreadMessages} />
            </Link>
            <Link
              to="/notifications"
              className={styles.bell}
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell size={20} aria-hidden />
              <UnreadBadge count={unread} />
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.sidebar} aria-label="App">
          <ul>
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className={styles.navLink}>
                  <Icon size={20} aria-hidden />
                  <span>{label}</span>
                  <UnreadBadge count={badges[to] ?? 0} />
                </NavLink>
              </li>
            ))}
            <li>
              <NavLink to={profilePath} className={styles.navLink}>
                <User size={20} aria-hidden />
                <span>Profile</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <main id="main" tabIndex={-1} className={styles.main}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        <aside className={styles.rail} aria-label="Trending">
          <TrendingRail />
        </aside>
      </div>

      <nav className={styles.bottomNav} aria-label="App">
        {[
          { to: "/feed", label: "Home", icon: Home },
          { to: "/communities", label: "Communities", icon: Users },
          { to: "/messages", label: "Messages", icon: MessagesSquare },
          { to: "/notifications", label: "Alerts", icon: Bell },
          { to: profilePath, label: "Profile", icon: User },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink key={label} to={to} className={styles.bottomLink}>
            <span className={styles.bottomIcon}>
              <Icon size={22} aria-hidden />
              <UnreadBadge count={badges[to] ?? 0} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
