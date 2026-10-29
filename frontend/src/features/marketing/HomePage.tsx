import { ArrowRight, CheckCircle2, Flame, Heart, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Img } from "@/components/ui/Img";
import { brand } from "@/config/brand";
import { TrendingList } from "@/features/discovery/TrendingRail";

import { FAQ, FEATURES, TESTIMONIALS } from "./content";
import styles from "./Marketing.module.css";

export function CallToAction() {
  const { status } = useAuth();
  return (
    <section className="section">
      <div className="container">
        <div className={styles.cta}>
          <h2>Ready to catch the conversation?</h2>
          <p>Join thousands of students sharing, organising and discovering what's happening around them.</p>
          <div className={styles.ctaActions}>
            {status === "signed-in" ? (
              <ButtonLink to="/feed" variant="inverse" size="lg">
                Open your feed
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/register" variant="inverse" size="lg">
                  Create your free account
                </ButtonLink>
                <ButtonLink to="/features" size="lg" className={styles.ctaGhost}>
                  See how it works
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqList({ items = FAQ }: { items?: { q: string; a: string }[] }) {
  return (
    <div className={styles.faq}>
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { status } = useAuth();
  return (
    <>
      <Seo />
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <p className="eyebrow">Your campus, in one loop</p>
            <h1 className={styles.heroTitle}>
              {brand.tagline.replace(/\.$/, "")}
              <span className="text-gradient">.</span>
            </h1>
            <p className={styles.heroLead}>
              {brand.name} brings the feed, communities, anonymous gist, events, a safe marketplace and podcasts
              together, built for students and safe by design.
            </p>
            <div className={styles.heroActions}>
              {status === "signed-in" ? (
                <ButtonLink to="/feed" size="lg">
                  Open your feed <ArrowRight size={18} aria-hidden />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/register" size="lg">
                    Join free <ArrowRight size={18} aria-hidden />
                  </ButtonLink>
                  <ButtonLink to="/communities" size="lg" variant="secondary">
                    Explore communities
                  </ButtonLink>
                </>
              )}
            </div>
            <div className={styles.heroNote}>
              <span>
                <CheckCircle2 size={16} aria-hidden /> Free forever
              </span>
              <span>
                <CheckCircle2 size={16} aria-hidden /> No ads in your gist
              </span>
              <span>
                <CheckCircle2 size={16} aria-hidden /> You own your data
              </span>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <Img
              src={brand.assets.hero}
              alt="Students chatting and sharing on GistLoop"
              className={styles.heroImage}
              loading="eager"
            />
            <div className={`${styles.floating} ${styles.floatingA}`} aria-hidden>
              <span className={styles.floatingIcon}>
                <Flame size={18} />
              </span>
              #hackathon is trending
            </div>
            <div className={`${styles.floating} ${styles.floatingB}`} aria-hidden>
              <span className={styles.floatingIcon}>
                <Heart size={18} />
              </span>
              128 people loved this
            </div>
          </div>
        </div>
      </section>

      <section className={styles.logos} aria-label="Partners">
        <div className="container">
          <p>Loved by students, societies and partners across Nigeria</p>
          <ul className={styles.logoRow}>
            {brand.assets.partners.map((logo, i) => (
              <li key={i}>
                <Img src={logo} alt={`Partner ${i + 1}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="eyebrow">Everything in one place</p>
            <h2>All of campus life, one tap away</h2>
            <p>Stop juggling ten group chats. {brand.name} gives every conversation a home.</p>
          </div>
          <div className={styles.features}>
            {FEATURES.map(({ key, icon: Icon, title, summary, to }) => (
              <article key={key} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <Icon size={24} aria-hidden />
                </span>
                <h3>{title}</h3>
                <p>{summary}</p>
                <Link to={to} style={{ marginTop: "auto", fontWeight: 650 }}>
                  Learn more <span aria-hidden>→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--color-bg-subtle)" }}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="eyebrow">How it works</p>
            <h2>Up and running in a minute</h2>
          </div>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <h3>Create your account</h3>
              <p>Sign up with your email, pick a username and you're in. Verify your school to unlock campus spaces.</p>
            </li>
            <li className={styles.step}>
              <h3>Join your communities</h3>
              <p>Find your department, hostel, clubs and interests, or start your own in seconds.</p>
            </li>
            <li className={styles.step}>
              <h3>Catch the conversation</h3>
              <p>Post, comment, RSVP, buy and sell, listen and share the gist, publicly or anonymously.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className={`container ${styles.split}`}>
          <div>
            <p className="eyebrow">
              <Flame size={14} aria-hidden /> Live on {brand.name}
            </p>
            <h2 style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-3)" }}>What everyone's talking about</h2>
            <p className="lead" style={{ marginTop: "var(--space-4)" }}>
              Trending is ranked by how fast conversations are growing, not just likes, so new voices get heard too.
            </p>
            <ButtonLink to={status === "signed-in" ? "/feed" : "/register"} style={{ marginTop: "var(--space-6)" }}>
              Join the conversation
            </ButtonLink>
          </div>
          <Card>
            <TrendingList limit={6} />
          </Card>
        </div>
      </section>

      <section className="section" style={{ background: "var(--color-bg-subtle)" }}>
        <div className={`container ${styles.split} ${styles.splitReverse}`}>
          <div>
            <p className="eyebrow">
              <ShieldCheck size={14} aria-hidden /> Safe by design
            </p>
            <h2 style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-3)" }}>
              Your safety isn't a feature. It's the foundation.
            </h2>
            <ul className={styles.checks}>
              <li>
                <CheckCircle2 size={20} aria-hidden /> Report anything in two taps; trained moderators review it.
              </li>
              <li>
                <CheckCircle2 size={20} aria-hidden /> Privacy controls for your profile, followers and mentions.
              </li>
              <li>
                <CheckCircle2 size={20} aria-hidden /> Anonymous gist with encrypted identities and strict safeguards.
              </li>
              <li>
                <CheckCircle2 size={20} aria-hidden /> Secure sign-in, device management and two-step verification.
              </li>
            </ul>
            <ButtonLink to="/safety" variant="secondary" style={{ marginTop: "var(--space-6)" }}>
              Visit the safety centre
            </ButtonLink>
          </div>
          <Img src={brand.assets.appPreview} alt={`${brand.name} app preview`} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="eyebrow">Loved on campus</p>
            <h2>Don't take our word for it</h2>
          </div>
          <div className={styles.quotes}>
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className={styles.quote}>
                <blockquote>“{t.quote}”</blockquote>
                <figcaption>
                  <Avatar name={t.name} size="sm" />
                  {t.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="eyebrow">Questions</p>
            <h2>Frequently asked</h2>
          </div>
          <FaqList items={FAQ.slice(0, 5)} />
          <p style={{ textAlign: "center", marginTop: "var(--space-6)" }}>
            <Link to="/help">See all questions</Link>
          </p>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
