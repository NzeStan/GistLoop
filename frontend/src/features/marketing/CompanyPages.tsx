import { CheckCircle2, Download, Heart, Lightbulb, Mail, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";

import { PageHero } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { AnchorButton, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Img } from "@/components/ui/Img";
import { brand } from "@/config/brand";

import { FEATURES, FAQ } from "./content";
import { CallToAction, FaqList } from "./HomePage";
import styles from "./Marketing.module.css";

export function AboutPage() {
  const values = [
    {
      icon: ShieldCheck,
      title: "Safety first",
      text: "Every feature starts with the question: how could this hurt someone, and how do we prevent it?",
    },
    {
      icon: Users,
      title: "Community-led",
      text: "Students shape the spaces they use. Moderators, organisers and creators get real tools.",
    },
    {
      icon: Heart,
      title: "Respect for privacy",
      text: "We collect only what we need, never sell personal data, and give you control.",
    },
    {
      icon: Lightbulb,
      title: "Built for Africa",
      text: "Designed for Nigerian campuses first, for low data costs and patchy networks, and ready for the continent.",
    },
  ];
  const team = [
    { image: brand.assets.team.founder, name: "Founder & CEO", role: "Product and partnerships" },
    { image: brand.assets.team.design, name: "Head of Design", role: "Experience and accessibility" },
    { image: brand.assets.team.engineering, name: "Head of Engineering", role: "Platform and security" },
    { image: brand.assets.team.community, name: "Head of Community", role: "Trust, safety and growth" },
  ];
  return (
    <>
      <Seo title="About us" description={`The story and mission behind ${brand.name}.`} />
      <PageHero
        eyebrow="About us"
        title={`We're building the place where campus talks`}
        description={`${brand.name} started with a simple frustration: campus life was scattered across dozens of group chats, noticeboards and feeds. We're bringing it together, safely.`}
      />
      <section className="section">
        <div className={`container ${styles.split}`}>
          <Img src={brand.assets.aboutStory} alt={`The ${brand.name} team at work`} />
          <div className="prose">
            <p className="eyebrow">Our story</p>
            <h2 style={{ fontSize: "var(--text-3xl)" }}>From group-chat chaos to one loop</h2>
            <p>
              Important updates got buried. Events were missed. Good questions went unasked because people were afraid
              of being judged. And buying a used textbook meant trusting a stranger with your money.
            </p>
            <p>
              {brand.name} fixes that with one home for the feed, communities, anonymous gist, events, a marketplace
              with escrow and podcasts, built on a platform designed for security and privacy from day one.
            </p>
            <p>
              <strong>Our mission:</strong> to help every student find their people, their voice and their
              opportunities.
            </p>
          </div>
        </div>
      </section>
      <section className="section" style={{ background: "var(--color-bg-subtle)" }}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="eyebrow">What we believe</p>
            <h2>Our values</h2>
          </div>
          <div className={styles.features}>
            {values.map(({ icon: Icon, title, text }) => (
              <article key={title} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <Icon size={24} aria-hidden />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="eyebrow">The team</p>
            <h2>The people behind the loop</h2>
          </div>
          <div className={styles.team}>
            {team.map((member) => (
              <div key={member.name} className={styles.member}>
                <Img src={member.image} alt="" />
                <h3>{member.name}</h3>
                <p className="muted">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}

export function FeaturesPage() {
  return (
    <>
      <Seo title="Features" description={`Everything you can do on ${brand.name}.`} />
      <PageHero
        eyebrow="Features"
        title="Everything campus life needs"
        description={`One account for your feed, communities, anonymous gist, events, a safe marketplace and podcasts.`}
      />
      {FEATURES.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <section
            key={feature.key}
            id={feature.key}
            className="section"
            style={index % 2 ? { background: "var(--color-bg-subtle)" } : undefined}
          >
            <div className={`container ${styles.split} ${index % 2 ? styles.splitReverse : ""}`}>
              <div>
                <span className={styles.featureIcon}>
                  <Icon size={24} aria-hidden />
                </span>
                <h2 style={{ fontSize: "var(--text-3xl)", marginTop: "var(--space-4)" }}>{feature.title}</h2>
                <p className="lead" style={{ marginTop: "var(--space-3)" }}>
                  {feature.summary}
                </p>
                <ul className={styles.checks}>
                  {feature.points.map((point) => (
                    <li key={point}>
                      <CheckCircle2 size={20} aria-hidden /> {point}
                    </li>
                  ))}
                </ul>
              </div>
              <Img src={brand.assets.features[feature.key]} alt="" />
            </div>
          </section>
        );
      })}
      <CallToAction />
    </>
  );
}

export function HelpPage() {
  return (
    <>
      <Seo title="Help centre" description={`Answers to common questions about ${brand.name}.`} />
      <PageHero
        eyebrow="Help centre"
        title="How can we help?"
        description="Answers to the questions we hear most. Can't find yours? We're a message away."
      />
      <section className="section">
        <div className="container">
          <FaqList items={FAQ} />
          <Card style={{ maxWidth: "48rem", margin: "var(--space-10) auto 0", textAlign: "center" }}>
            <h2 style={{ fontSize: "var(--text-xl)" }}>Still need help?</h2>
            <p className="muted" style={{ margin: "var(--space-2) 0 var(--space-4)" }}>
              Our support team replies within one working day.
            </p>
            <ButtonLink to="/contact?topic=support">Contact support</ButtonLink>
          </Card>
        </div>
      </section>
    </>
  );
}

export function CareersPage() {
  const perks = ["Remote-friendly, Lagos hub", "Health insurance", "Learning budget", "Mission that matters"];
  return (
    <>
      <Seo title="Careers" description={`Work with us at ${brand.name}.`} />
      <PageHero
        eyebrow="Careers"
        title="Help us build the home of campus conversation"
        description="We're a small team with a big mission. If you care about craft, safety and young people, let's talk."
      />
      <section className="section">
        <div className="container-narrow stack" style={{ "--stack-gap": "var(--space-8)" } as React.CSSProperties}>
          <div>
            <h2 style={{ fontSize: "var(--text-2xl)" }}>Why join us</h2>
            <ul className={styles.checks}>
              {perks.map((perk) => (
                <li key={perk}>
                  <CheckCircle2 size={20} aria-hidden /> {perk}
                </li>
              ))}
            </ul>
          </div>
          <Card>
            <h2 style={{ fontSize: "var(--text-xl)" }}>Open roles</h2>
            <p className="muted" style={{ marginTop: "var(--space-2)" }}>
              We don't have open roles right now, but we're always happy to meet great people: engineers, designers,
              community managers and campus ambassadors.
            </p>
            <AnchorButton
              href={`mailto:${brand.contact.email}?subject=Careers`}
              leading={<Mail size={16} />}
              style={{ marginTop: "var(--space-4)" }}
            >
              Send us your CV
            </AnchorButton>
          </Card>
        </div>
      </section>
    </>
  );
}

export function PressPage() {
  const assets = [
    { label: "Logo", href: brand.assets.logo },
    { label: "Logo for dark backgrounds", href: brand.assets.logoOnDark },
    { label: "App icon", href: brand.assets.icon512 },
    { label: "Social banner", href: brand.assets.socialShare },
  ];
  return (
    <>
      <Seo title="Press" description={`News, brand assets and media contacts for ${brand.name}.`} />
      <PageHero
        eyebrow="Press"
        title={`${brand.name} in the news`}
        description="Brand assets, company facts and a direct line to our team."
      />
      <section className="section">
        <div className="container-narrow stack" style={{ "--stack-gap": "var(--space-6)" } as React.CSSProperties}>
          <Card>
            <h2 style={{ fontSize: "var(--text-xl)" }}>Fast facts</h2>
            <ul className={styles.checks}>
              <li>
                <CheckCircle2 size={20} aria-hidden /> {brand.name}: “{brand.tagline}”
              </li>
              <li>
                <CheckCircle2 size={20} aria-hidden /> Headquartered in {brand.contact.address}
              </li>
              <li>
                <CheckCircle2 size={20} aria-hidden /> Feed, communities, anonymous gist, events, marketplace and
                podcasts
              </li>
            </ul>
          </Card>
          <Card>
            <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Brand assets</h2>
            <div className="cluster">
              {assets.map((a) => (
                <AnchorButton
                  key={a.label}
                  href={a.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  leading={<Download size={16} />}
                >
                  {a.label}
                </AnchorButton>
              ))}
            </div>
            <p className="muted" style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)" }}>
              Please don't alter the logo or colours. Primary colour {brand.colors.primary}, accent{" "}
              {brand.colors.accent}.
            </p>
          </Card>
          <Card>
            <h2 style={{ fontSize: "var(--text-xl)" }}>Media enquiries</h2>
            <p className="muted" style={{ margin: "var(--space-2) 0 var(--space-4)" }}>
              Journalists and creators: we usually reply the same day.
            </p>
            <AnchorButton href={`mailto:${brand.contact.press}`} leading={<Mail size={16} />}>
              {brand.contact.press}
            </AnchorButton>
          </Card>
        </div>
      </section>
    </>
  );
}

export function SafetyPage() {
  return (
    <>
      <Seo title="Safety centre" description={`How ${brand.name} keeps you safe, and what you can do.`} />
      <PageHero
        eyebrow="Safety centre"
        title="Staying safe on GistLoop"
        description="The tools we give you, how moderation works and where to get help fast."
      />
      <section className="section">
        <div className="container-narrow prose">
          <h2>If you're in danger</h2>
          <p>
            If you or someone else is in immediate danger, call <strong>112</strong> (Nigeria's emergency number) or
            your local emergency services first. Then report the content on {brand.name} so we can act.
          </p>
          <h2>Tools you control</h2>
          <ul>
            <li>
              <strong>Report</strong> any post, comment or gist from its menu. Reports are confidential.
            </li>
            <li>
              <strong>Block, mute or restrict</strong> people from their profile.
            </li>
            <li>
              <strong>Approve followers</strong> and limit who can mention you in{" "}
              <Link to="/settings/privacy">privacy settings</Link>.
            </li>
            <li>
              <strong>See every device</strong> signed in to your account and sign any of them out in{" "}
              <Link to="/settings/security">security settings</Link>.
            </li>
          </ul>
          <h2>How moderation works</h2>
          <p>
            Reports go to trained moderators, who can hide content, warn, restrict or suspend accounts. Every decision
            is logged, and you can appeal decisions about your own content. Community moderators help keep their spaces
            on track within our <Link to="/guidelines">community guidelines</Link>.
          </p>
          <h2>Anonymous gist safeguards</h2>
          <p>
            Anonymous posts can only be made inside communities, by established accounts. Identities are encrypted and
            stored separately; revealing one requires two authorised people and a serious legal or safety reason, and is
            permanently audited.
          </p>
          <h2>Marketplace safety</h2>
          <p>
            Pay through {brand.name} so your money stays in escrow until you confirm delivery. Meet in public places on
            campus, inspect items before confirming, and never share passwords or bank PINs.
          </p>
          <h2>Contact our safety team</h2>
          <p>
            Email <a href={`mailto:${brand.contact.safety}`}>{brand.contact.safety}</a> or use the{" "}
            <Link to="/contact?topic=safety">contact form</Link> and choose “Safety or abuse”.
          </p>
        </div>
      </section>
    </>
  );
}
