/**
 * Legal pages. This is a solid, plain-English starting point that reflects how GistLoop actually
 * works (essential cookies only, data export and deletion, escrow, anonymous gist safeguards).
 * Have a qualified lawyer review it against the Nigeria Data Protection Act 2023 and your
 * operations before launch.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageHero } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { brand } from "@/config/brand";
import { formatDate } from "@/lib/format";

import styles from "./Marketing.module.css";

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return (
    <>
      <Seo title={title} description={intro} />
      <PageHero eyebrow="Legal" title={title} description={`Last updated ${formatDate(brand.legal.policiesUpdated)}`} />
      <section className="section">
        <div className={`container ${styles.legal}`}>
          <nav className={styles.toc} aria-label="On this page">
            <strong>On this page</strong>
            <ol style={{ marginTop: "var(--space-3)" }}>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="prose">
            <p>{intro}</p>
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.title}</h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
      </section>
    </>
  );
}

const company = brand.legal.companyName;
const name = brand.name;

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms are an agreement between you and ${company} ("we", "us") about your use of ${name}. Please read them; by creating an account you accept them.`}
      sections={[
        {
          id: "eligibility",
          title: "Who can use GistLoop",
          body: (
            <p>
              You must be at least 16 years old and able to form a binding agreement. If you use {name} on behalf of an
              organisation, you confirm you're authorised to do so.
            </p>
          ),
        },
        {
          id: "account",
          title: "Your account",
          body: (
            <p>
              Keep your sign-in details secure and tell us immediately about any unauthorised use. You're responsible
              for activity on your account. Usernames that impersonate others or mislead may be reclaimed.
            </p>
          ),
        },
        {
          id: "content",
          title: "Your content",
          body: (
            <>
              <p>
                You own what you post. You give us a worldwide, non-exclusive, royalty-free licence to host, display and
                distribute it as needed to run {name}. You can delete your content at any time.
              </p>
              <p>
                You confirm you have the rights to anything you post and that it follows our{" "}
                <Link to="/guidelines">community guidelines</Link>.
              </p>
            </>
          ),
        },
        {
          id: "conduct",
          title: "Acceptable use",
          body: (
            <ul>
              <li>No harassment, hate, threats, or sharing others' private information.</li>
              <li>No illegal goods or services, scams, spam or malware.</li>
              <li>No attempts to break, overload, scrape or reverse-engineer the service.</li>
              <li>No misuse of anonymous features to bully, defame or threaten.</li>
            </ul>
          ),
        },
        {
          id: "anonymous",
          title: "Anonymous gist",
          body: (
            <p>
              Anonymous posts hide your identity from other users, not from the law. We may reveal an author's identity
              through our audited two-person process where required by law or to prevent serious harm.
            </p>
          ),
        },
        {
          id: "marketplace",
          title: "Marketplace and payments",
          body: (
            <p>
              Sellers are responsible for their listings. Online payments are held in escrow and released after the
              buyer confirms delivery or a dispute is resolved. We aren't a party to the sale itself. Fees, if any, are
              shown before you pay.
            </p>
          ),
        },
        {
          id: "moderation",
          title: "Moderation and enforcement",
          body: (
            <p>
              We may remove content or restrict accounts that break these terms or our guidelines, and we'll tell you
              why where we can. You can appeal decisions about your content from your account.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Disclaimers and liability",
          body: (
            <p>
              {name} is provided "as is". To the extent the law allows, we aren't liable for indirect or consequential
              losses, and our total liability is limited to the amount you paid us in the 12 months before the claim.
              Nothing limits liability that can't be limited by law.
            </p>
          ),
        },
        {
          id: "termination",
          title: "Ending this agreement",
          body: (
            <p>
              You can delete your account at any time in <Link to="/settings/data">settings</Link>. We may suspend or
              end access for serious or repeated breaches.
            </p>
          ),
        },
        {
          id: "law",
          title: "Governing law",
          body: (
            <p>
              These terms are governed by the laws of the Federal Republic of Nigeria. Disputes will be handled by the
              courts of Lagos State, unless consumer law gives you other rights.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <p>
              Questions? Email <a href={`mailto:${brand.contact.email}`}>{brand.contact.email}</a> or write to {company}
              , {brand.contact.address}.
            </p>
          ),
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what personal data ${company} collects through ${name}, why, and the choices you have. We process data in line with the Nigeria Data Protection Act 2023 (NDPA) and other applicable laws.`}
      sections={[
        {
          id: "collect",
          title: "What we collect",
          body: (
            <ul>
              <li>
                <strong>Account data:</strong> name, username, email, password (stored only as a secure hash), and
                optionally phone number and institution.
              </li>
              <li>
                <strong>Content:</strong> posts, comments, messages, listings and uploads you create.
              </li>
              <li>
                <strong>Usage and device data:</strong> sign-in sessions, device type, approximate network information
                for security, and aggregate analytics.
              </li>
              <li>
                <strong>Contact messages</strong> you send us.
              </li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <ul>
              <li>To provide and secure the service, including fraud and abuse prevention.</li>
              <li>To personalise feeds and recommendations.</li>
              <li>To communicate with you about your account, and with your consent, about news.</li>
              <li>To meet legal obligations.</li>
            </ul>
          ),
        },
        {
          id: "basis",
          title: "Legal bases",
          body: (
            <p>
              We rely on performing our contract with you, our legitimate interests in running a safe service, your
              consent (which you can withdraw at any time), and legal obligations.
            </p>
          ),
        },
        {
          id: "anonymous",
          title: "Anonymous gist",
          body: (
            <p>
              For anonymous posts, your identity is encrypted with keys kept separate from the main database. It's
              revealed only through an audited two-person process for serious legal or safety reasons.
            </p>
          ),
        },
        {
          id: "sharing",
          title: "Sharing",
          body: (
            <p>
              We never sell your personal data. We share it only with service providers who help us run {name} (such as
              hosting, email and payment processors) under contract, when you choose to make content public, or when the
              law requires.
            </p>
          ),
        },
        {
          id: "analytics",
          title: "Analytics",
          body: (
            <p>
              Our analytics store aggregate counts, not individual browsing histories. Small groups are suppressed in
              reports so individuals can't be singled out.
            </p>
          ),
        },
        {
          id: "retention",
          title: "How long we keep data",
          body: (
            <p>
              We keep data only as long as needed. Deleted accounts are anonymised after a 30-day grace period; security
              logs and contact messages are deleted on fixed schedules.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <p>
              You can access, correct, download (<Link to="/settings/data">export your data</Link>) and delete your
              data, object to certain processing and withdraw consent. You can also complain to the Nigeria Data
              Protection Commission.
            </p>
          ),
        },
        {
          id: "security",
          title: "Security",
          body: (
            <p>
              We use encryption in transit, hashed passwords, short-lived sign-in tokens, device management and strict
              access controls. No system is perfect; tell us at{" "}
              <a href={`mailto:${brand.contact.safety}`}>{brand.contact.safety}</a> if you find a problem.
            </p>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: (
            <p>
              {name} isn't for anyone under 16. If you believe a child has an account, contact us and we'll remove it.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact and data protection officer",
          body: (
            <p>
              Email <a href={`mailto:${brand.contact.email}`}>{brand.contact.email}</a> or write to {company},{" "}
              {brand.contact.address}.
            </p>
          ),
        },
      ]}
    />
  );
}

export function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      intro={`${name} uses as few cookies as possible, and none for advertising or cross-site tracking. That's why you don't see a cookie banner.`}
      sections={[
        {
          id: "essential",
          title: "Essential cookies",
          body: (
            <>
              <p>
                We use one essential cookie to keep you signed in securely. It's set only when you sign in, is
                unreadable by scripts on the page, and is only ever sent to our own sign-in service.
              </p>
              <table>
                <thead>
                  <tr>
                    <th align="left">Name</th>
                    <th align="left">Purpose</th>
                    <th align="left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>__Secure-gl_rt</code>
                    </td>
                    <td>Keeps you signed in</td>
                    <td>Up to 30 days</td>
                  </tr>
                </tbody>
              </table>
            </>
          ),
        },
        {
          id: "storage",
          title: "Local storage",
          body: (
            <p>
              Your browser also remembers your light/dark theme choice and whether you were signed in (so we can restore
              your session quickly). These never leave your device.
            </p>
          ),
        },
        {
          id: "third",
          title: "Third parties",
          body: (
            <p>
              Images and fonts may be served from content delivery networks, which receive standard request information
              (such as your IP address) to deliver files. We don't use third-party analytics or advertising cookies.
            </p>
          ),
        },
        {
          id: "control",
          title: "Your choices",
          body: (
            <p>
              You can clear cookies and site data in your browser at any time. Blocking the essential cookie means you
              won't be able to stay signed in.
            </p>
          ),
        },
      ]}
    />
  );
}

export function GuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      intro={`${name} works when everyone can join the conversation safely. These guidelines apply everywhere on ${name}, including anonymous gist.`}
      sections={[
        {
          id: "respect",
          title: "Be respectful",
          body: <p>Disagree with ideas, not people. No harassment, bullying, insults or pile-ons.</p>,
        },
        {
          id: "hate",
          title: "No hate or violence",
          body: (
            <p>
              No attacks on people based on ethnicity, religion, gender, sexuality, disability or other protected
              characteristics. No threats, glorifying violence or encouraging self-harm.
            </p>
          ),
        },
        {
          id: "privacy",
          title: "Respect privacy",
          body: (
            <p>
              Don't share anyone's private information (phone numbers, addresses, photos, documents) without consent. No
              doxxing, no exposing people anonymously.
            </p>
          ),
        },
        {
          id: "honest",
          title: "Be honest",
          body: <p>No impersonation, scams, fake giveaways, misleading listings or coordinated manipulation.</p>,
        },
        {
          id: "safe",
          title: "Keep it safe and legal",
          body: (
            <p>
              No illegal goods, drugs, weapons, exam malpractice services, or sexual content involving minors (which we
              report to authorities). Adult content isn't allowed.
            </p>
          ),
        },
        {
          id: "spam",
          title: "No spam",
          body: (
            <p>
              Don't flood feeds, communities or inboxes. Promotion is fine in moderation and where communities allow it.
            </p>
          ),
        },
        {
          id: "anonymous",
          title: "Anonymous gist",
          body: (
            <p>
              Anonymity is for honesty, not harm. Rumours that could damage someone's reputation, targeted harassment
              and threats will be removed, and serious cases may be traced.
            </p>
          ),
        },
        {
          id: "enforcement",
          title: "What happens if you break them",
          body: (
            <p>
              Depending on severity: content removal, a warning, temporary restrictions, suspension or a permanent ban.
              You can appeal decisions about your own content. See the <Link to="/safety">safety centre</Link> for more.
            </p>
          ),
        },
      ]}
    />
  );
}
