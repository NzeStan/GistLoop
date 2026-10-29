import { Link } from "react-router";

import { Logo } from "@/components/Logo";
import { brand } from "@/config/brand";

import { NewsletterForm } from "./NewsletterForm";
import styles from "./SiteFooter.module.css";
import { SocialLinks } from "./SocialLinks";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/communities", label: "Communities" },
      { to: "/events", label: "Events" },
      { to: "/marketplace", label: "Marketplace" },
      { to: "/podcasts", label: "Podcasts" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About us" },
      { to: "/careers", label: "Careers" },
      { to: "/press", label: "Press" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { to: "/help", label: "Help centre" },
      { to: "/safety", label: "Safety centre" },
      { to: "/guidelines", label: "Community guidelines" },
      { to: "/contact?topic=support", label: "Report a problem" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/terms", label: "Terms of service" },
      { to: "/privacy", label: "Privacy policy" },
      { to: "/cookies", label: "Cookie policy" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <Logo />
            <p className={styles.tagline}>{brand.tagline}</p>
            <p className="muted">{brand.description}</p>
            <SocialLinks />
          </div>
          <div className={styles.newsletterBlock}>
            <h2 className={styles.heading}>Stay in the loop</h2>
            <p className="muted">The best of campus conversations, once a week. No spam, unsubscribe anytime.</p>
            <NewsletterForm />
          </div>
        </div>
        <nav className={styles.columns} aria-label="Footer">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className={styles.heading}>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.bottom}>
          <p>
            © {year} {brand.legal.companyName}. All rights reserved.
          </p>
          <p>Made with care in {brand.contact.address.split(",").slice(-1)[0]?.trim() || "Africa"} 💜</p>
        </div>
      </div>
    </footer>
  );
}
