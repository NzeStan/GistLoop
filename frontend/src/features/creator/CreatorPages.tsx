import { BadgeCheck, Handshake, Plus, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { useCreatorAnalytics } from "@/api/queries/analytics";
import {
  type CreatorProfile,
  type MediaKit,
  type OwnCreatorProfile,
  type Participation,
  type Sponsorship,
  type SponsorshipWrite,
  useAddDeliverable,
  useApplyToSponsorship,
  useCreator,
  useCreatorCategories,
  useCreatorMediaKit,
  useCreatorProviders,
  useCreators,
  useDecideParticipation,
  useDeliverables,
  useInviteCreator,
  useLinkAccount,
  useMyCreatorProfile,
  useMyCreatorVerification,
  useMyLinkedAccounts,
  useMyMediaKit,
  useMyParticipations,
  useMySponsorships,
  useParticipants,
  useRemoveLinkedAccount,
  useRequestCreatorVerification,
  useReviewDeliverable,
  useRotateMediaKitLink,
  useSaveCreatorProfile,
  useSaveSponsorship,
  useSponsorship,
  useSponsorshipAction,
  useSponsorships,
  useSubmitDeliverable,
  useUpdateLinkedAccount,
  useUpdateMediaKit,
  useVerifyLinkedAccount,
  useWithdrawCreatorVerification,
} from "@/api/queries/creator";
import { errorMessage } from "@/api/errors";
import type { Range } from "@/api/queries/analytics";
import { AnalyticsReportView, RangePicker } from "@/components/AnalyticsReport";
import { ActionButton, KeyValues, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { ShareMenu } from "@/components/ShareMenu";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useCopy } from "@/components/ui/useCopy";
import browse from "@/features/content/Browse.module.css";
import { BrowseShell } from "@/features/content/BrowseShell";
import { formatCount, formatDate, formatMoney, humanize } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { safeUrl } from "@/lib/links";

const FORMER = {
  id: "",
  handle: null as string | null,
  display_name: "Former member",
  avatar_url: null as string | null,
};

const reach = (p: CreatorProfile) => p.linked_accounts.reduce((n, a) => n + (a.follower_count ?? 0), 0);

function CreatorCard({ creator: c }: { creator: CreatorProfile }) {
  const handle = (c.user ?? FORMER).handle ?? c.id;
  return (
    <Card interactive padded={false}>
      <Link to={`/creators/${handle}`} className={browse.tile}>
        <div className={browse.tileBody}>
          <span className="cluster">
            <Avatar
              name={(c.user ?? FORMER).display_name}
              seed={(c.user ?? FORMER).id}
              src={(c.user ?? FORMER).avatar_url}
            />
            <strong>{(c.user ?? FORMER).display_name}</strong>
            {c.is_verified && (
              <BadgeCheck size={16} aria-label="Verified creator" style={{ color: "var(--color-primary)" }} />
            )}
          </span>
          <p className={browse.tileText}>{c.headline}</p>
          <div className={browse.tileMeta}>
            {c.categories.slice(0, 3).map((cat) => (
              <Badge key={cat.key}>{cat.name}</Badge>
            ))}
            <span className={browse.metaItem}>{formatCount(c.verified_reach || reach(c))} reach</span>
            {c.open_to_sponsorships && <Badge tone="success">Open to sponsorships</Badge>}
          </div>
        </div>
      </Link>
    </Card>
  );
}

/** /creators: find creators for a campaign. */
export function CreatorsPage() {
  const categories = useCreatorCategories();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [verified, setVerified] = useState(false);
  const [open, setOpen] = useState(false);
  const list = useCreators({ q: useDebounced(q), category, verified, open });
  return (
    <BrowseShell
      eyebrow="Creators"
      title="Student creators brands can work with"
      description="Campus influencers, podcasters and writers. Verified creators have proven they own their accounts."
      actions={<ButtonLink to="/creator">Your creator profile</ButtonLink>}
    >
      <Seo title="Creators" description="Find student creators on GistLoop for your campaign." />
      <div className={browse.toolbar}>
        <Input
          aria-label="Search creators"
          type="search"
          placeholder="Search creators"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Every category</option>
          {categories.data?.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </Select>
        <Checkbox label="Verified only" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        <Checkbox label="Open to sponsorships" checked={open} onChange={(e) => setOpen(e.target.checked)} />
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : list.data.results.length === 0 ? (
        <EmptyState icon={Sparkles} title="No creators found" />
      ) : (
        <div className={browse.grid}>
          {list.data.results.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      )}
    </BrowseShell>
  );
}

function MediaKitView({
  kit,
}: {
  kit: Pick<MediaKit, "summary" | "audience" | "rates" | "highlights" | "platform_stats">;
}) {
  const rates = (Array.isArray(kit.rates) ? kit.rates : []) as {
    deliverable: string;
    price_minor: number;
    currency: string;
    notes: string;
  }[];
  const highlights = (Array.isArray(kit.highlights) ? kit.highlights : []) as {
    title: string;
    brand: string;
    url: string;
    year: string;
  }[];
  const audience = (kit.audience && typeof kit.audience === "object" ? kit.audience : {}) as Record<
    string,
    Record<string, number>
  >;
  return (
    <div className="stack">
      {kit.summary && <p className="pre-wrap">{kit.summary}</p>}
      {Object.keys(audience).length > 0 && (
        <>
          <h3 style={{ fontSize: "var(--text-base)" }}>Audience</h3>
          {Object.entries(audience).map(([group, shares]) => (
            <p key={group} className={m.small}>
              <strong>{group}:</strong>{" "}
              {Object.entries(shares)
                .map(([k, v]) => `${k} ${v}%`)
                .join(" · ")}
            </p>
          ))}
        </>
      )}
      {rates.length > 0 && (
        <>
          <h3 style={{ fontSize: "var(--text-base)" }}>Rates</h3>
          <ul className={m.list}>
            {rates.map((r, i) => (
              <li key={i} className={m.item}>
                <span>{r.deliverable}</span>
                <strong>{formatMoney(r.price_minor, r.currency)}</strong>
                {r.notes && <span className={m.small}>{r.notes}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {highlights.length > 0 && (
        <>
          <h3 style={{ fontSize: "var(--text-base)" }}>Past work</h3>
          <ul style={{ paddingLeft: "1.2em" }}>
            {highlights.map((h, i) => {
              const url = safeUrl(h.url);
              return (
                <li key={i}>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow">
                      {h.title}
                    </a>
                  ) : (
                    h.title
                  )}
                  {h.brand && ` for ${h.brand}`} {h.year && `(${h.year})`}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** /creators/:handle */
export function CreatorPage() {
  const { handle } = useParams();
  const [params] = useSearchParams();
  const creator = useCreator(handle);
  const kit = useCreatorMediaKit(handle, params.get("token") ?? undefined);
  if (creator.isPending) return <PageLoader />;
  if (creator.isError) return <ErrorState error={creator.error} />;
  if (!creator.data) {
    return (
      <EmptyState title="No creator profile" action={<ButtonLink to={`/u/${handle}`}>See their profile</ButtonLink>}>
        This person hasn't set up a creator profile.
      </EmptyState>
    );
  }
  const c = creator.data;
  return (
    <div className="stack">
      <Seo title={`${(c.user ?? FORMER).display_name}: creator`} description={c.headline} />
      <Card>
        <div className="cluster" style={{ justifyContent: "space-between" }}>
          <span className="cluster">
            <Avatar
              name={(c.user ?? FORMER).display_name}
              seed={(c.user ?? FORMER).id}
              src={(c.user ?? FORMER).avatar_url}
              size="lg"
            />
            <span className="stack" style={{ "--stack-gap": "var(--space-1)" } as React.CSSProperties}>
              <h1 style={{ fontSize: "var(--text-2xl)" }}>
                {(c.user ?? FORMER).display_name}{" "}
                {c.is_verified && (
                  <BadgeCheck size={20} aria-label="Verified" style={{ color: "var(--color-primary)" }} />
                )}
              </h1>
              <span className="muted">{c.headline}</span>
              {(c.user ?? FORMER).handle && (
                <Link to={`/u/${(c.user ?? FORMER).handle}`}>@{(c.user ?? FORMER).handle}</Link>
              )}
            </span>
          </span>
          <ShareMenu title={`${(c.user ?? FORMER).display_name} on GistLoop`} path={`/creators/${handle}`} />
        </div>
        {c.bio && (
          <p className="pre-wrap" style={{ marginTop: "var(--space-3)" }}>
            {c.bio}
          </p>
        )}
        <div className="cluster" style={{ marginTop: "var(--space-3)" }}>
          {c.categories.map((cat) => (
            <Badge key={cat.key}>{cat.name}</Badge>
          ))}
          {c.city && <span className="muted">{c.city}</span>}
          {c.open_to_sponsorships && <Badge tone="success">Open to sponsorships</Badge>}
          {c.business_email && <a href={`mailto:${c.business_email}`}>{c.business_email}</a>}
        </div>
      </Card>
      {c.linked_accounts.length > 0 && (
        <Section title="Where to find them">
          <ul className={m.list}>
            {c.linked_accounts.map((a) => {
              const url = safeUrl(a.url);
              return (
                <li key={a.id} className={m.item}>
                  <span>
                    <strong>{humanize(a.provider)}</strong>{" "}
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer nofollow">
                        @{a.handle}
                      </a>
                    ) : (
                      `@${a.handle}`
                    )}
                  </span>
                  <span className={m.small}>
                    {a.follower_count != null && `${formatCount(a.follower_count)} followers`}
                    {a.ownership === "verified" && " · ownership verified"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {kit.data && (
        <Section title="Media kit">
          <MediaKitView kit={kit.data} />
        </Section>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ your hub
function ProfileForm({ profile }: { profile: OwnCreatorProfile | null }) {
  const save = useSaveCreatorProfile(Boolean(profile));
  const categories = useCreatorCategories();
  const toast = useToast();
  const [form, setForm] = useState({
    headline: profile?.headline ?? "",
    bio: profile?.bio ?? "",
    city: profile?.city ?? "",
    business_email: profile?.business_email ?? "",
    categories: profile?.categories.map((c) => c.key) ?? [],
    open_to_sponsorships: profile?.open_to_sponsorships ?? true,
    is_discoverable: profile?.is_discoverable ?? true,
    status: (profile?.status ?? "active") as "active" | "paused",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      className={m.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { ...form, country: "NG", business_email: form.business_email || "" },
          { onSuccess: () => toast.success("Creator profile saved"), onError: (err) => toast.error(errorMessage(err)) },
        );
      }}
    >
      <Field label="Headline" hint="e.g. Tech reviews for Nigerian students">
        <Input value={form.headline} maxLength={160} onChange={set("headline")} />
      </Field>
      <Field label="About you">
        <Textarea value={form.bio} onChange={set("bio")} />
      </Field>
      <div className={m.formRow}>
        <Field label="City" optional>
          <Input value={form.city} onChange={set("city")} />
        </Field>
        <Field label="Business email" optional hint="Shown to brands.">
          <Input type="email" value={form.business_email} onChange={set("business_email")} />
        </Field>
      </div>
      <fieldset className="cluster" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 650 }}>What you make</legend>
        {categories.data?.map((c) => (
          <Checkbox
            key={c.key}
            label={c.name}
            checked={form.categories.includes(c.key)}
            onChange={() =>
              setForm((f) => ({
                ...f,
                categories: f.categories.includes(c.key)
                  ? f.categories.filter((k) => k !== c.key)
                  : [...f.categories, c.key],
              }))
            }
          />
        ))}
      </fieldset>
      <Checkbox
        label="Open to sponsorships"
        checked={form.open_to_sponsorships}
        onChange={(e) => setForm((f) => ({ ...f, open_to_sponsorships: e.target.checked }))}
      />
      <Checkbox
        label="Show me in the creators directory"
        checked={form.is_discoverable}
        onChange={(e) => setForm((f) => ({ ...f, is_discoverable: e.target.checked }))}
      />
      {profile && (
        <Checkbox
          label="Pause my creator profile"
          checked={form.status === "paused"}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? "paused" : "active" }))}
        />
      )}
      <div>
        <Button type="submit" loading={save.isPending}>
          {profile ? "Save" : "Create creator profile"}
        </Button>
      </div>
    </form>
  );
}

function Accounts() {
  const accounts = useMyLinkedAccounts();
  const providers = useCreatorProviders();
  const link = useLinkAccount();
  const update = useUpdateLinkedAccount();
  const remove = useRemoveLinkedAccount();
  const verify = useVerifyLinkedAccount();
  const toast = useToast();
  const [form, setForm] = useState({ provider: "", handle: "", followers: "" });
  return (
    <Section
      title="Your accounts"
      description="Link Instagram, TikTok, X, YouTube and more. Verify ownership to earn the verified badge."
    >
      <ul className={m.list}>
        {accounts.data?.map((a) => (
          <li key={a.id} className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span className="cluster" style={{ justifyContent: "space-between" }}>
              <span>
                <strong>{humanize(a.provider)}</strong> @{a.handle}{" "}
                <StatusBadge status={a.ownership === "verified" ? "verified" : a.ownership} />
              </span>
              <span className={m.rowActions}>
                <Checkbox
                  label="Public"
                  checked={a.is_public}
                  onChange={(e) => update.mutate({ id: a.id, body: { is_public: e.target.checked } })}
                />
                {a.ownership !== "verified" && (
                  <ActionButton run={() => verify.mutateAsync(a.id)} success="Checking ownership…">
                    Verify
                  </ActionButton>
                )}
                <ActionButton
                  variant="danger"
                  confirm={`Unlink @${a.handle}?`}
                  run={() => remove.mutateAsync(a.id)}
                  success="Unlinked"
                >
                  Unlink
                </ActionButton>
              </span>
            </span>
            {a.ownership !== "verified" && a.challenge && (
              <span className={m.small}>
                To verify, add <code>{a.challenge}</code> to your {humanize(a.provider)} bio, then press Verify.
              </span>
            )}
            <span className={m.small}>
              {a.follower_count != null
                ? `${formatCount(a.follower_count)} followers (${humanize(a.count_source)})`
                : "Followers not set"}
            </span>
          </li>
        ))}
      </ul>
      <form
        className="cluster"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          link.mutate(
            {
              provider: form.provider,
              handle: form.handle.replace(/^@/, "").trim(),
              follower_count: form.followers ? Number(form.followers) : null,
            },
            {
              onSuccess: () => (setForm({ provider: "", handle: "", followers: "" }), toast.success("Account linked")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <Field label="Platform">
          <Select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
            <option value="">Choose</option>
            {providers.data?.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Username">
          <Input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} />
        </Field>
        <Field label="Followers" optional>
          <Input
            type="number"
            min={0}
            value={form.followers}
            onChange={(e) => setForm((f) => ({ ...f, followers: e.target.value }))}
          />
        </Field>
        <Button type="submit" loading={link.isPending} disabled={!form.provider || !form.handle.trim()}>
          Link
        </Button>
      </form>
    </Section>
  );
}

function Verification() {
  const current = useMyCreatorVerification();
  const request = useRequestCreatorVerification();
  const withdraw = useWithdrawCreatorVerification();
  const toast = useToast();
  const [statement, setStatement] = useState("");
  const [links, setLinks] = useState("");
  if (current.isPending) return <Spinner />;
  const v = current.data;
  return (
    <Section
      title="Creator verification"
      description="Verified creators get a badge and can join campaigns that need verified reach."
    >
      {v && (
        <Alert tone={v.status === "approved" ? "success" : v.status === "rejected" ? "warning" : "info"}>
          Request {humanize(v.status)}
          {v.decision_reason && `: ${v.decision_reason}`}
        </Alert>
      )}
      {v?.status === "pending" ? (
        <ActionButton
          confirm="Withdraw your verification request?"
          run={() => withdraw.mutateAsync()}
          success="Withdrawn"
        >
          Withdraw request
        </ActionButton>
      ) : v?.status !== "approved" ? (
        <form
          className={m.form}
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate(
              { statement, links: links.split(/\s+/).filter((l) => l.startsWith("https://")) },
              { onSuccess: () => toast.success("Sent for review"), onError: (err) => toast.error(errorMessage(err)) },
            );
          }}
        >
          <Field label="Why should we verify you?">
            <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} required />
          </Field>
          <Field label="Links to your best work" optional hint="https:// links, one per line.">
            <Textarea value={links} onChange={(e) => setLinks(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" loading={request.isPending} disabled={!statement.trim()}>
              Request verification
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
  );
}

function KitEditor() {
  const kit = useMyMediaKit();
  const update = useUpdateMediaKit();
  const rotate = useRotateMediaKitLink();
  const copy = useCopy();
  const toast = useToast();
  const [draft, setDraft] = useState<{ summary: string; rates: string; highlights: string; audience: string } | null>(
    null,
  );
  if (kit.isPending) return <Spinner />;
  if (kit.isError) return <ErrorState error={kit.error} />;
  const k = kit.data;
  const handle = k.profile.user?.handle ?? k.profile.id;
  const rates = (Array.isArray(k.rates) ? k.rates : []) as { deliverable: string; price_minor: number }[];
  const highlights = (Array.isArray(k.highlights) ? k.highlights : []) as {
    title: string;
    brand: string;
    url: string;
    year: string;
  }[];
  const audience = (k.audience && typeof k.audience === "object" ? k.audience : {}) as Record<
    string,
    Record<string, number>
  >;
  const values = draft ?? {
    summary: k.summary,
    rates: rates.map((r) => `${r.deliverable} | ${r.price_minor / 100}`).join("\n"),
    highlights: highlights.map((h) => [h.title, h.brand, h.url, h.year].join(" | ")).join("\n"),
    audience: Object.entries(audience)
      .map(
        ([g, shares]) =>
          `${g}: ${Object.entries(shares)
            .map(([a, b]) => `${a}=${b}`)
            .join(", ")}`,
      )
      .join("\n"),
  };
  const lines = (text: string) =>
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  const save = () =>
    update.mutate(
      {
        summary: values.summary,
        rates: lines(values.rates).map((l) => {
          const [deliverable, price] = l.split("|").map((x) => x.trim());
          return { deliverable, price_minor: Math.round(Number(price || 0) * 100), currency: "NGN" };
        }),
        highlights: lines(values.highlights).map((l) => {
          const [title, brand = "", url = "", year = ""] = l.split("|").map((x) => x.trim());
          return { title, brand, url, year };
        }),
        audience: Object.fromEntries(
          lines(values.audience).map((l) => {
            const [group, rest = ""] = l.split(":");
            return [
              group!.trim(),
              Object.fromEntries(
                rest
                  .split(",")
                  .map((pair) => pair.split("=").map((x) => x.trim()))
                  .filter(([a, b]) => a && b)
                  .map(([a, b]) => [a, Number(b)]),
              ),
            ];
          }),
        ),
      },
      {
        onSuccess: () => (setDraft(null), toast.success("Media kit saved")),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  const shareUrl = `${window.location.origin}/creators/${handle}${k.visibility === "unlisted" ? `?token=${k.share_token}` : ""}`;
  return (
    <Section title="Media kit" description="What brands see: your summary, audience, rates and past work.">
      <div className="cluster">
        <Field label="Who can see it">
          <Select
            value={k.visibility}
            onChange={(e) => update.mutate({ visibility: e.target.value as MediaKit["visibility"] })}
          >
            <option value="public">Anyone</option>
            <option value="unlisted">Only people with the link</option>
            <option value="private">Only me</option>
          </Select>
        </Field>
        <Checkbox
          label="Show platform stats"
          checked={k.show_platform_stats}
          onChange={(e) => update.mutate({ show_platform_stats: e.target.checked })}
        />
        {k.visibility !== "private" && (
          <Button size="sm" variant="secondary" onClick={() => void copy(shareUrl, "Link copied")}>
            Copy link
          </Button>
        )}
        {k.visibility === "unlisted" && (
          <ActionButton
            confirm="Make a new link? The old one stops working."
            run={() => rotate.mutateAsync()}
            success="New link made"
          >
            New link
          </ActionButton>
        )}
      </div>
      <Field label="Summary">
        <Textarea value={values.summary} onChange={(e) => setDraft({ ...values, summary: e.target.value })} />
      </Field>
      <Field label="Rates" hint="One per line: what | price in naira (e.g. Instagram story | 15000)">
        <Textarea value={values.rates} onChange={(e) => setDraft({ ...values, rates: e.target.value })} />
      </Field>
      <Field label="Past work" hint="One per line: title | brand | https://link | year">
        <Textarea value={values.highlights} onChange={(e) => setDraft({ ...values, highlights: e.target.value })} />
      </Field>
      <Field label="Audience" hint="One breakdown per line, e.g. Age: 18-24=60, 25-34=30">
        <Textarea value={values.audience} onChange={(e) => setDraft({ ...values, audience: e.target.value })} />
      </Field>
      <div>
        <Button loading={update.isPending} onClick={save}>
          Save media kit
        </Button>
      </div>
    </Section>
  );
}

function ParticipationCard({ p, manager }: { p: Participation; manager: boolean }) {
  const deliverables = useDeliverables(p.id);
  const decide = useDecideParticipation();
  const add = useAddDeliverable(p.id);
  const submit = useSubmitDeliverable();
  const review = useReviewDeliverable();
  const toast = useToast();
  const [fee, setFee] = useState("");
  const [title, setTitle] = useState("");
  const [submission, setSubmission] = useState<Record<string, string>>({});
  const campaign = p.campaign as { id?: string; title?: string; brand_name?: string };
  const creator = p.creator as { user?: { display_name?: string; handle?: string | null } };
  const act = (action: "shortlist" | "accept" | "decline" | "complete" | "cancel" | "withdraw", extra: object = {}) =>
    decide.mutateAsync({ id: p.id, body: { action, ...extra } });
  return (
    <li className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
      <span className="cluster" style={{ justifyContent: "space-between" }}>
        <span className={m.itemMain}>
          <strong>
            {manager ? (
              creator.user?.handle ? (
                <Link to={`/creators/${creator.user.handle}`}>{creator.user.display_name}</Link>
              ) : (
                creator.user?.display_name
              )
            ) : (
              <Link to={`/sponsorships/${campaign.id}`}>{campaign.title}</Link>
            )}
          </strong>
          <span className={m.small}>
            {!manager && campaign.brand_name}
            {p.pitch && ` "${p.pitch.slice(0, 140)}"`}
            {p.proposed_fee_minor != null && ` · asks ${formatMoney(p.proposed_fee_minor, "NGN")}`}
            {p.agreed_fee_minor != null && ` · agreed ${formatMoney(p.agreed_fee_minor, "NGN")}`}
          </span>
        </span>
        <StatusBadge status={p.status} />
      </span>
      <div className={m.rowActions} style={{ justifyContent: "flex-start" }}>
        {manager && ["applied", "invited"].includes(p.status) && (
          <ActionButton run={() => act("shortlist")} success="Shortlisted">
            Shortlist
          </ActionButton>
        )}
        {manager && ["applied", "shortlisted"].includes(p.status) && (
          <>
            <Input
              aria-label="Agreed fee (₦)"
              type="number"
              placeholder="Fee ₦"
              style={{ width: "8rem" }}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
            <ActionButton
              variant="primary"
              run={() => act("accept", fee ? { fee_minor: Math.round(Number(fee) * 100) } : {})}
              success="Accepted"
            >
              Accept
            </ActionButton>
            <ActionButton reason="Note (optional)" run={(note) => act("decline", { note })} success="Declined">
              Decline
            </ActionButton>
          </>
        )}
        {manager && p.status === "accepted" && (
          <>
            <ActionButton run={() => act("complete")} success="Marked complete">
              Mark complete
            </ActionButton>
            <ActionButton variant="danger" reason="Why?" run={(note) => act("cancel", { note })} success="Cancelled">
              Cancel
            </ActionButton>
          </>
        )}
        {!manager && ["applied", "shortlisted", "invited", "accepted"].includes(p.status) && (
          <>
            {p.status === "invited" && (
              <ActionButton variant="primary" run={() => act("accept")} success="Accepted">
                Accept invitation
              </ActionButton>
            )}
            <ActionButton confirm="Withdraw from this campaign?" run={() => act("withdraw")} success="Withdrawn">
              Withdraw
            </ActionButton>
          </>
        )}
      </div>
      {p.status === "accepted" || p.status === "completed" ? (
        <div className="stack" style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
          <strong style={{ fontSize: "var(--text-sm)" }}>Deliverables</strong>
          {deliverables.data?.map((d) => (
            <div key={d.id} className={m.small}>
              <span className="cluster">
                <strong>{d.title}</strong> <StatusBadge status={d.status} />
                {d.due_at && `due ${formatDate(d.due_at)}`}
                {d.submission_url && safeUrl(d.submission_url) && (
                  <a href={safeUrl(d.submission_url)!} target="_blank" rel="noopener noreferrer nofollow">
                    View
                  </a>
                )}
              </span>
              {d.review_note && <p>Brand: {d.review_note}</p>}
              {!manager && ["pending", "changes_requested"].includes(d.status) && (
                <span className="cluster">
                  <Input
                    aria-label="Link to your post"
                    placeholder="https://link-to-your-post"
                    value={submission[d.id] ?? ""}
                    onChange={(e) => setSubmission((s) => ({ ...s, [d.id]: e.target.value }))}
                  />
                  <ActionButton
                    run={() =>
                      submit.mutateAsync({
                        id: d.id,
                        body: { url: submission[d.id] ?? "", disclosure_confirmed: true },
                      })
                    }
                    success="Submitted"
                  >
                    Submit (I labelled it #ad)
                  </ActionButton>
                </span>
              )}
              {manager && d.status === "submitted" && (
                <span className="cluster">
                  <ActionButton
                    variant="primary"
                    run={() => review.mutateAsync({ id: d.id, body: { approve: true } })}
                    success="Approved"
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    reason="What needs changing?"
                    run={(note) => review.mutateAsync({ id: d.id, body: { approve: false, note } })}
                    success="Changes requested"
                  >
                    Ask for changes
                  </ActionButton>
                </span>
              )}
            </div>
          ))}
          {manager && p.status === "accepted" && (
            <form
              className="cluster"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate(
                  { title },
                  { onSuccess: () => setTitle(""), onError: (err) => toast.error(errorMessage(err)) },
                );
              }}
            >
              <Input
                aria-label="New deliverable"
                placeholder="e.g. 1 Instagram reel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={!title.trim()}>
                Add deliverable
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </li>
  );
}

function MyCampaigns() {
  const list = useMyParticipations();
  return (
    <Section title="Your sponsorships" description={<Link to="/sponsorships">Find open sponsorships →</Link>}>
      {list.isPending ? (
        <Spinner />
      ) : (list.data ?? []).length === 0 ? (
        <p className="muted">You haven't joined any yet.</p>
      ) : (
        <ul className={m.list}>
          {list.data!.map((p) => (
            <ParticipationCard key={p.id} p={p} manager={false} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function CreatorStats() {
  const [range, setRange] = useState<Range>({});
  const report = useCreatorAnalytics(range);
  return (
    <Section title="Your numbers">
      <RangePicker value={range} onChange={setRange} />
      <AnalyticsReportView query={report} />
    </Section>
  );
}

type HubTab = "profile" | "accounts" | "verification" | "kit" | "sponsorships" | "stats";

/** /creator: your creator profile and work. */
export function CreatorHubPage() {
  const profile = useMyCreatorProfile();
  const [tab, setTab] = useState<HubTab>("profile");
  if (profile.isPending) return <PageLoader />;
  if (profile.isError) return <ErrorState error={profile.error} />;
  const p = profile.data;
  return (
    <div className="stack">
      <Seo title="Creator" noIndex />
      <PageHeader
        eyebrow={
          <>
            <Sparkles size={14} aria-hidden /> Creator
          </>
        }
        title="Your creator profile"
        description="Get discovered by brands, show your media kit and get paid for sponsorships."
        actions={
          p?.user?.handle ? (
            <ButtonLink to={`/creators/${p.user?.handle}`} variant="secondary">
              View public page
            </ButtonLink>
          ) : undefined
        }
      />
      {!p ? (
        <Section title="Become a creator">
          <ProfileForm profile={null} />
        </Section>
      ) : (
        <>
          <Tabs
            label="Creator"
            value={tab}
            onChange={setTab}
            items={[
              { value: "profile", label: "Profile" },
              { value: "accounts", label: "Accounts" },
              { value: "verification", label: "Verification" },
              { value: "kit", label: "Media kit" },
              { value: "sponsorships", label: "Sponsorships" },
              { value: "stats", label: "Stats" },
            ]}
          />
          {tab === "profile" && (
            <Section
              title="Profile"
              description={p.is_verified ? <Badge tone="success">Verified creator</Badge> : undefined}
            >
              <ProfileForm profile={p} />
            </Section>
          )}
          {tab === "accounts" && <Accounts />}
          {tab === "verification" && <Verification />}
          {tab === "kit" && <KitEditor />}
          {tab === "sponsorships" && <MyCampaigns />}
          {tab === "stats" && <CreatorStats />}
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------- sponsorships
function SponsorshipCard({ s }: { s: Sponsorship }) {
  return (
    <Card interactive padded={false}>
      <Link to={`/sponsorships/${s.id}`} className={browse.tile}>
        <div className={browse.tileBody}>
          <div className={browse.tileMeta}>
            <Badge tone="primary">{s.brand_name}</Badge>
            {s.verified_only && <Badge>Verified creators</Badge>}
            <StatusBadge status={s.status} />
          </div>
          <h3 className={browse.tileTitle}>{s.title}</h3>
          <p className={browse.tileText}>{s.brief.slice(0, 140)}</p>
          <div className={browse.tileMeta}>
            {s.budget_minor != null && (
              <span className={browse.metaItem}>Budget {formatMoney(s.budget_minor, s.currency)}</span>
            )}
            {s.slots_left != null && <span className={browse.metaItem}>{s.slots_left} spots left</span>}
            {s.application_deadline && (
              <span className={browse.metaItem}>Apply by {formatDate(s.application_deadline)}</span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}

/** /sponsorships: brand campaigns creators can apply to. */
export function SponsorshipsPage() {
  const [q, setQ] = useState("");
  const categories = useCreatorCategories();
  const [category, setCategory] = useState("");
  const list = useSponsorships(useDebounced(q), category);
  const mine = useMySponsorships();
  return (
    <BrowseShell
      eyebrow="Sponsorships"
      title="Paid campaigns for student creators"
      description="Brands looking for campus creators. Apply with a pitch; payment is agreed before you start."
      actions={
        <div className="cluster">
          <ButtonLink to="/creator" variant="secondary">
            Creator profile
          </ButtonLink>
          <ButtonLink to="/sponsorships/new" leading={<Plus size={16} />}>
            Run a campaign
          </ButtonLink>
        </div>
      }
    >
      <Seo title="Sponsorships" />
      {mine.data && mine.data.length > 0 && (
        <Section title="Campaigns you run">
          <ul className={m.list}>
            {mine.data.map((s) => (
              <li key={s.id} className={m.item}>
                <Link to={`/sponsorships/${s.id}`}>{s.title}</Link>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className={browse.toolbar}>
        <Input
          aria-label="Search sponsorships"
          type="search"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Every category</option>
          {categories.data?.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : list.data.results.length === 0 ? (
        <EmptyState icon={Handshake} title="No open campaigns right now" />
      ) : (
        <div className={browse.grid}>
          {list.data.results.map((s) => (
            <SponsorshipCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </BrowseShell>
  );
}

function SponsorshipForm({ initial, onSaved }: { initial?: Sponsorship; onSaved: (s: Sponsorship) => void }) {
  const save = useSaveSponsorship();
  const categories = useCreatorCategories();
  const [form, setForm] = useState({
    brand_name: initial?.brand_name ?? "",
    title: initial?.title ?? "",
    brief: initial?.brief ?? "",
    deliverables_summary: initial?.deliverables_summary ?? "",
    budget: initial?.budget_minor != null ? String(initial.budget_minor / 100) : "",
    slots: initial?.slots != null ? String(initial.slots) : "",
    application_deadline: initial?.application_deadline?.slice(0, 10) ?? "",
    starts_on: initial?.starts_on ?? "",
    ends_on: initial?.ends_on ?? "",
    visibility: initial?.visibility ?? "public",
    verified_only: initial?.verified_only ?? false,
    disclosure_required: initial?.disclosure_required ?? true,
    categories: initial?.categories.map((c) => c.key) ?? [],
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      className={m.form}
      onSubmit={(e) => {
        e.preventDefault();
        const body: SponsorshipWrite = {
          brand_name: form.brand_name,
          title: form.title,
          brief: form.brief,
          deliverables_summary: form.deliverables_summary,
          budget_minor: form.budget ? Math.round(Number(form.budget) * 100) : null,
          currency: "NGN",
          slots: form.slots ? Number(form.slots) : null,
          application_deadline: form.application_deadline ? new Date(form.application_deadline).toISOString() : null,
          starts_on: form.starts_on || null,
          ends_on: form.ends_on || null,
          visibility: form.visibility as SponsorshipWrite["visibility"],
          verified_only: form.verified_only,
          disclosure_required: form.disclosure_required,
          categories: form.categories,
        };
        save.mutate({ id: initial?.id, body }, { onSuccess: onSaved });
      }}
    >
      <div className={m.formRow}>
        <Field label="Brand">
          <Input value={form.brand_name} onChange={set("brand_name")} required />
        </Field>
        <Field label="Campaign title">
          <Input value={form.title} onChange={set("title")} required />
        </Field>
      </div>
      <Field label="Brief">
        <Textarea rows={5} value={form.brief} onChange={set("brief")} required />
      </Field>
      <Field label="What creators deliver">
        <Input
          value={form.deliverables_summary}
          onChange={set("deliverables_summary")}
          placeholder="e.g. 1 reel + 2 stories"
        />
      </Field>
      <div className={m.formRow}>
        <Field label="Budget (₦)" optional>
          <Input type="number" min={0} value={form.budget} onChange={set("budget")} />
        </Field>
        <Field label="Creators wanted" optional>
          <Input type="number" min={1} value={form.slots} onChange={set("slots")} />
        </Field>
        <Field label="Apply by" optional>
          <Input type="date" value={form.application_deadline} onChange={set("application_deadline")} />
        </Field>
        <Field label="Starts" optional>
          <Input type="date" value={form.starts_on} onChange={set("starts_on")} />
        </Field>
        <Field label="Ends" optional>
          <Input type="date" value={form.ends_on} onChange={set("ends_on")} />
        </Field>
        <Field label="Who can apply">
          <Select value={form.visibility} onChange={set("visibility")}>
            <option value="public">Any creator</option>
            <option value="invite_only">Only creators I invite</option>
          </Select>
        </Field>
      </div>
      <fieldset className="cluster" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 650 }}>Categories</legend>
        {categories.data?.map((c) => (
          <Checkbox
            key={c.key}
            label={c.name}
            checked={form.categories.includes(c.key)}
            onChange={() =>
              setForm((f) => ({
                ...f,
                categories: f.categories.includes(c.key)
                  ? f.categories.filter((k) => k !== c.key)
                  : [...f.categories, c.key],
              }))
            }
          />
        ))}
      </fieldset>
      <Checkbox
        label="Verified creators only"
        checked={form.verified_only}
        onChange={(e) => setForm((f) => ({ ...f, verified_only: e.target.checked }))}
      />
      <Checkbox
        label="Creators must label posts as ads (required by advertising rules)"
        checked={form.disclosure_required}
        onChange={(e) => setForm((f) => ({ ...f, disclosure_required: e.target.checked }))}
      />
      {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
      <div>
        <Button type="submit" loading={save.isPending}>
          {initial ? "Save" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}

/** /sponsorships/new */
export function NewSponsorshipPage() {
  const navigate = useNavigate();
  return (
    <div className="stack">
      <Seo title="Run a campaign" noIndex />
      <PageHeader eyebrow={<Link to="/sponsorships">← Sponsorships</Link>} title="Run a creator campaign" />
      <Section
        title="Campaign details"
        description="It's saved as a draft. Publish it when you're ready for applications."
      >
        <SponsorshipForm onSaved={(s) => navigate(`/sponsorships/${s.id}`)} />
      </Section>
    </div>
  );
}

function InviteCreators({ campaignId }: { campaignId: string }) {
  const [q, setQ] = useState("");
  const creators = useCreators({ q: useDebounced(q), open: true });
  const invite = useInviteCreator(campaignId);
  return (
    <Section title="Invite creators">
      <Input
        aria-label="Search creators"
        type="search"
        placeholder="Search creators"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className={m.list}>
        {creators.data?.results.slice(0, 8).map((c) => (
          <li key={c.id} className={m.item}>
            <span>
              {(c.user ?? FORMER).display_name} <span className={m.small}>{c.headline}</span>
            </span>
            <ActionButton run={() => invite.mutateAsync({ profile_id: c.id })} success="Invited">
              Invite
            </ActionButton>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** /sponsorships/:campaignId */
export function SponsorshipPage() {
  const { campaignId = "" } = useParams();
  const campaign = useSponsorship(campaignId);
  const action = useSponsorshipAction(campaignId);
  const apply = useApplyToSponsorship(campaignId);
  const creator = useMyCreatorProfile();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(false);
  const [pitch, setPitch] = useState("");
  const [fee, setFee] = useState("");
  const viewer = (campaign.data?.viewer ?? {}) as { can_manage?: boolean; participation_status?: string | null };
  const participants = useParticipants(campaignId, status, Boolean(viewer.can_manage));
  if (campaign.isPending) return <PageLoader />;
  if (campaign.isError) return <ErrorState error={campaign.error} />;
  const c = campaign.data;
  return (
    <div className="stack">
      <Seo title={c.title} description={c.brief.slice(0, 160)} />
      <PageHeader
        eyebrow={<Link to="/sponsorships">← Sponsorships</Link>}
        title={c.title}
        description={
          <span className="cluster">
            <Badge tone="primary">{c.brand_name}</Badge> <StatusBadge status={c.status} />
          </span>
        }
        actions={<ShareMenu title={`${c.brand_name}: ${c.title}`} path={`/sponsorships/${c.id}`} />}
      />
      <Section title="The brief">
        <p className="pre-wrap">{c.brief}</p>
        <KeyValues
          items={[
            ["Deliverables", c.deliverables_summary],
            ["Budget", c.budget_minor != null ? formatMoney(c.budget_minor, c.currency) : null],
            ["Spots", c.slots != null ? `${c.slots_left ?? c.slots} of ${c.slots} left` : null],
            ["Apply by", c.application_deadline && formatDate(c.application_deadline)],
            ["Runs", c.starts_on && `${formatDate(c.starts_on)}${c.ends_on ? ` – ${formatDate(c.ends_on)}` : ""}`],
            [
              "Who",
              c.verified_only
                ? `Verified creators${c.min_verified_reach ? ` with ${formatCount(c.min_verified_reach)}+ reach` : ""}`
                : "Any creator",
            ],
            ["Ad label", c.disclosure_required ? "Required (#ad / Sponsored)" : null],
          ]}
        />
      </Section>
      {viewer.can_manage ? (
        <>
          <Section title="Manage">
            <div className="cluster">
              {c.status === "draft" && (
                <ActionButton
                  variant="primary"
                  run={() => action.mutateAsync({ action: "publish" })}
                  success="Published"
                >
                  Publish
                </ActionButton>
              )}
              {c.status === "open" && (
                <ActionButton run={() => action.mutateAsync({ action: "close" })} success="Applications closed">
                  Close applications
                </ActionButton>
              )}
              {(c.status === "open" || c.status === "closed") && (
                <ActionButton run={() => action.mutateAsync({ action: "complete" })} success="Completed">
                  Mark complete
                </ActionButton>
              )}
              {c.status !== "completed" && c.status !== "cancelled" && (
                <ActionButton
                  variant="danger"
                  reason="Why? (sent to creators)"
                  run={(reason) => action.mutateAsync({ action: "cancel", reason })}
                  success="Cancelled"
                >
                  Cancel campaign
                </ActionButton>
              )}
              <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
                {editing ? "Close editor" : "Edit"}
              </Button>
            </div>
            {editing && <SponsorshipForm initial={c} onSaved={() => (setEditing(false), toast.success("Saved"))} />}
          </Section>
          <Section title="Creators">
            <Select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ maxWidth: "14rem" }}
            >
              <option value="">Everyone</option>
              {["applied", "invited", "shortlisted", "accepted", "declined", "withdrawn", "completed"].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
            {participants.isPending ? (
              <Spinner />
            ) : (participants.data ?? []).length === 0 ? (
              <p className="muted">No creators yet.</p>
            ) : (
              <ul className={m.list}>
                {participants.data!.map((p) => (
                  <ParticipationCard key={p.id} p={p} manager />
                ))}
              </ul>
            )}
          </Section>
          <InviteCreators campaignId={c.id} />
        </>
      ) : viewer.participation_status ? (
        <Alert tone="info">
          You're {humanize(viewer.participation_status)} on this campaign. Follow it in{" "}
          <Link to="/creator">your creator profile</Link>.
        </Alert>
      ) : c.status === "open" ? (
        <Section title="Apply">
          {!creator.data ? (
            <p>
              <Link to="/creator">Create a creator profile</Link> first.
            </p>
          ) : (
            <form
              className={m.form}
              onSubmit={(e) => {
                e.preventDefault();
                apply.mutate(
                  { pitch, proposed_fee_minor: fee ? Math.round(Number(fee) * 100) : null },
                  {
                    onSuccess: () => toast.success("Application sent"),
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                );
              }}
            >
              <Field label="Your pitch">
                <Textarea value={pitch} onChange={(e) => setPitch(e.target.value)} required />
              </Field>
              <Field label="Your fee (₦)" optional>
                <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
              </Field>
              <div>
                <Button type="submit" loading={apply.isPending} disabled={!pitch.trim()}>
                  Apply
                </Button>
              </div>
            </form>
          )}
        </Section>
      ) : null}
    </div>
  );
}
