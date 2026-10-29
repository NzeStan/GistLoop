import { ImagePlus, Megaphone, Pause, Play } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import {
  type Campaign,
  useCampaign,
  useCampaignAction,
  useCampaignImage,
  useCampaignStats,
  useCampaigns,
  useCreateCampaign,
  usePromotionOptions,
} from "@/api/queries/monetization";
import { startCheckout } from "@/api/queries/payments";
import type { components } from "@/api/schema";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import styles from "@/features/content/Lists.module.css";
import { formatCount, formatDate, formatMoney, humanize } from "@/lib/format";
import { CONTENT_LABELS, contentHref, safeUrl } from "@/lib/links";

type S = components["schemas"];

const PLACEMENT_LABELS: Record<string, string> = {
  feed: "Home feed",
  events: "Events",
  marketplace: "Marketplace",
  opportunities: "Opportunities",
};

const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  pending_payment: "warning",
  in_review: "primary",
  active: "success",
  paused: "warning",
  completed: "neutral",
  rejected: "danger",
};

const STATUS_HELP: Record<string, string> = {
  draft: "Not submitted yet. Check the details, then submit it for review.",
  pending_payment: "Waiting for payment. Once paid, our team reviews it (usually within a day).",
  in_review: "Paid and waiting for review. You'll be notified when it goes live.",
  active: "Live. It's being shown to people now.",
  paused: "Paused. Nobody sees it until you resume.",
  completed: "Finished: the budget was spent or the end date passed.",
  rejected: "Not approved. You can edit and submit it again; payment is refunded.",
};

const toMinor = (naira: string) => Math.round(Number(naira || 0) * 100);
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** /promote: the member's campaigns. */
export function CampaignsPage() {
  const campaigns = useCampaigns();
  return (
    <>
      <Seo title="Promotions" noIndex />
      <PageHeader
        title="Promotions"
        description="Boost your posts, listings, events and opportunities, or run an advert. Every promotion is labelled and reviewed."
        actions={<ButtonLink to="/promote/new">New advert</ButtonLink>}
      />
      <div className="stack">
        <Alert>
          To boost something you've posted, open it and choose <strong>Boost</strong>.
        </Alert>
        {campaigns.isPending ? (
          <Spinner />
        ) : campaigns.isError ? (
          <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
        ) : campaigns.data.results.length === 0 ? (
          <EmptyState icon={Megaphone} title="No promotions yet">
            Reach more students on campus. Your budget buys a set number of views.
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {campaigns.data.results.map((c) => (
              <li key={c.id}>
                <Card interactive>
                  <Link
                    to={`/promote/${c.id}`}
                    className={styles.row}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <div className={styles.info}>
                      <strong>{c.name}</strong>
                      <span className="muted">
                        {c.kind === "boost" ? `Boost · ${CONTENT_LABELS[c.content_type] ?? c.content_type}` : "Advert"}{" "}
                        · {formatDate(c.starts_at)} – {formatDate(c.ends_at)} ·{" "}
                        {formatMoney(c.budget_minor, c.currency)}
                      </span>
                      <span className="muted">
                        {formatCount(c.impressions)} views · {formatCount(c.clicks)} clicks
                      </span>
                    </div>
                    <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{humanize(c.status)}</Badge>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** /promote/new (an advert) or /promote/new?type=social.post&id=… (boost your own content). */
export function NewCampaignPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const options = usePromotionOptions();
  const create = useCreateCampaign();
  const uploadImage = useCampaignImage();
  const boostType = params.get("type") ?? "";
  const boostId = params.get("id") ?? "";
  const isBoost = Boolean(boostType && boostId);
  const boostLabel = CONTENT_LABELS[boostType] ?? "item";
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: isBoost ? `Boost: ${boostLabel}` : "",
    headline: "",
    body: "",
    call_to_action: "learn_more" as S["CallToActionEnum"],
    destination_url: "",
    placements: [] as string[],
    starts: day(0),
    ends: day(7),
    budget: "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (options.isPending) return <PageLoader />;
  if (options.isError) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />;

  const currency = "NGN";
  const cpm = Number((options.data.cpm_minor as Record<string, number>)[currency] ?? 0);
  const minBudget = Number((options.data.min_budget_minor as Record<string, number>)[currency] ?? 0);
  const budgetMinor = toMinor(form.budget);
  const estimate = cpm > 0 ? Math.floor((budgetMinor / cpm) * 1000) : 0;
  const placements = form.placements.length ? form.placements : options.data.placements;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      // Starts now if today was chosen; ends at the end of the chosen day.
      const startsAt = form.starts === day(0) ? new Date() : new Date(`${form.starts}T00:00:00`);
      const campaign = await create.mutateAsync({
        name: form.name,
        kind: isBoost ? "boost" : "ad",
        ...(isBoost
          ? { content_type: boostType, object_id: boostId }
          : {
              headline: form.headline,
              body: form.body,
              call_to_action: form.call_to_action,
              destination_url: form.destination_url,
            }),
        placements,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(`${form.ends}T23:59:00`).toISOString(),
        budget_minor: budgetMinor,
        currency,
      });
      if (image) {
        try {
          await uploadImage.mutateAsync({ id: campaign.id, file: image });
        } catch (error) {
          toast.error(`Image: ${errorMessage(error)}`);
        }
      }
      toast.success("Saved. Check it over, then submit it.");
      navigate(`/promote/${campaign.id}`);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const href = isBoost ? contentHref(boostType, boostId) : null;

  return (
    <>
      <Seo title={isBoost ? "Boost" : "New advert"} noIndex />
      <PageHeader
        title={isBoost ? `Boost your ${boostLabel.toLowerCase()}` : "New advert"}
        description="You pay the budget up front and it buys a set number of views. If we don't approve it, you get a full refund."
      />
      <Card>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
          {isBoost && href && (
            <Alert>
              Promoting <Link to={href}>this {boostLabel.toLowerCase()}</Link>. It's shown as-is, labelled "Sponsored".
            </Alert>
          )}
          {errors.object_id && <Alert tone="error">{errors.object_id}</Alert>}
          {errors.content_type && <Alert tone="error">{errors.content_type}</Alert>}
          <Field label="Name" hint="Only you see this." error={errors.name}>
            <Input maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          {!isBoost && (
            <>
              <Field label="Headline" error={errors.headline}>
                <Input maxLength={90} value={form.headline} onChange={(e) => set("headline", e.target.value)} />
              </Field>
              <Field label="Text" optional error={errors.body}>
                <Textarea rows={3} maxLength={240} value={form.body} onChange={(e) => set("body", e.target.value)} />
              </Field>
              <div className={styles.fields}>
                <Field label="Button" error={errors.call_to_action}>
                  <Select
                    value={form.call_to_action}
                    onChange={(e) => set("call_to_action", e.target.value as S["CallToActionEnum"])}
                  >
                    {(["learn_more", "sign_up", "shop_now", "register", "apply", "listen"] as const).map((c) => (
                      <option key={c} value={c}>
                        {humanize(c)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Link" hint="Must start with https://" error={errors.destination_url}>
                  <Input
                    type="url"
                    placeholder="https://"
                    value={form.destination_url}
                    onChange={(e) => set("destination_url", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Image" optional hint="Landscape works best (1.91:1). JPEG, PNG or WebP, up to 3 MB.">
                <div className="cluster">
                  <FilePicker
                    maxMb={3}
                    leading={<ImagePlus size={16} />}
                    onPick={(files) => setImage(files[0] ?? null)}
                  >
                    {image ? "Change image" : "Add image"}
                  </FilePicker>
                  {image && <span className="muted">{image.name}</span>}
                </div>
              </Field>
            </>
          )}
          <fieldset className={styles.options}>
            <legend>Where it appears</legend>
            {options.data.placements.map((p) => (
              <Checkbox
                key={p}
                label={PLACEMENT_LABELS[p] ?? humanize(p)}
                checked={placements.includes(p)}
                onChange={(e) =>
                  set("placements", e.target.checked ? [...placements, p] : placements.filter((x) => x !== p))
                }
              />
            ))}
            {errors.placements && <span className="muted">{errors.placements}</span>}
          </fieldset>
          <div className={styles.fields}>
            <Field label="Start" error={errors.starts_at}>
              <Input type="date" min={day(0)} value={form.starts} onChange={(e) => set("starts", e.target.value)} />
            </Field>
            <Field label="End" error={errors.ends_at}>
              <Input type="date" min={form.starts} value={form.ends} onChange={(e) => set("ends", e.target.value)} />
            </Field>
          </div>
          <Field
            label="Budget (₦)"
            hint={
              <>
                Minimum {formatMoney(minBudget, currency)}. {formatMoney(cpm, currency)} per 1,000 views
                {estimate > 0 && <> · about {formatCount(estimate)} views</>}.
              </>
            }
            error={errors.budget_minor}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={minBudget / 100}
              value={form.budget}
              onChange={(e) => set("budget", e.target.value)}
            />
          </Field>
          {errors.non_field_errors && <Alert tone="error">{errors.non_field_errors}</Alert>}
          <div>
            <Button
              type="submit"
              loading={saving}
              disabled={
                !form.name.trim() ||
                budgetMinor < minBudget ||
                placements.length === 0 ||
                (!isBoost && !form.headline.trim())
              }
            >
              Save and review
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

/** /promote/:campaignId */
export function CampaignPage() {
  const { campaignId } = useParams();
  const campaign = useCampaign(campaignId);
  const live = ["active", "paused", "completed"].includes(campaign.data?.status ?? "");
  const stats = useCampaignStats(campaignId, live);
  const act = useCampaignAction();
  const uploadImage = useCampaignImage();
  const toast = useToast();
  const [paying, setPaying] = useState(false);

  if (campaign.isPending) return <PageLoader />;
  if (campaign.isError) return <ErrorState error={campaign.error} onRetry={() => void campaign.refetch()} />;
  const c = campaign.data;
  const editable = c.status === "draft" || c.status === "rejected";

  const pay = async (target: Campaign) => {
    setPaying(true);
    try {
      await startCheckout("promotions.campaign", target.id);
    } catch (error) {
      setPaying(false);
      toast.error(errorMessage(error));
    }
  };
  const submit = () =>
    act.mutate(
      { id: c.id, action: "submit" },
      {
        onSuccess: (updated) => {
          if (updated.status === "pending_payment") void pay(updated);
          else toast.success("Submitted for review");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  const href = c.kind === "boost" ? contentHref(c.content_type, c.object_id) : null;
  const image = c.image_url && (safeUrl(c.image_url) ?? (c.image_url.startsWith("/") ? c.image_url : null));

  return (
    <>
      <Seo title={c.name} noIndex />
      <PageHeader
        eyebrow={<Link to="/promote">Promotions</Link>}
        title={c.name}
        actions={<Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{humanize(c.status)}</Badge>}
      />
      <div className="stack">
        <Alert tone={c.status === "rejected" ? "warning" : "info"}>
          {STATUS_HELP[c.status]}
          {c.review_note && (
            <>
              {" "}
              Reviewer's note: <em>{c.review_note}</em>
            </>
          )}
        </Alert>
        <Card>
          <div className="stack">
            {c.kind === "boost" ? (
              <p style={{ margin: 0 }}>
                Boosting{" "}
                {href ? (
                  <Link to={href}>your {(CONTENT_LABELS[c.content_type] ?? "item").toLowerCase()}</Link>
                ) : (
                  "your content"
                )}
                .
              </p>
            ) : (
              <div className="stack">
                {image && <img src={image} alt="" className={styles.preview} />}
                <strong>{c.headline}</strong>
                {c.body && (
                  <p className="muted" style={{ margin: 0 }}>
                    {c.body}
                  </p>
                )}
                <span className="muted">
                  {humanize(c.call_to_action)} → {c.destination_url}
                </span>
                {editable && (
                  <div>
                    <FilePicker
                      maxMb={3}
                      size="sm"
                      leading={<ImagePlus size={14} />}
                      loading={uploadImage.isPending}
                      onPick={(files) =>
                        files[0] &&
                        uploadImage.mutate(
                          { id: c.id, file: files[0] },
                          {
                            onSuccess: () => toast.success("Image updated"),
                            onError: (e) => toast.error(errorMessage(e)),
                          },
                        )
                      }
                    >
                      {image ? "Change image" : "Add image"}
                    </FilePicker>
                  </div>
                )}
              </div>
            )}
            <span className="muted">
              {(c.placements as string[] | undefined)?.map((p) => PLACEMENT_LABELS[p] ?? p).join(", ")} ·{" "}
              {formatDate(c.starts_at)} – {formatDate(c.ends_at)} · budget {formatMoney(c.budget_minor, c.currency)}
            </span>
            <div className="cluster">
              {editable && (
                <Button loading={act.isPending || paying} onClick={submit}>
                  Submit and pay {formatMoney(c.budget_minor, c.currency)}
                </Button>
              )}
              {c.status === "pending_payment" && (
                <Button loading={paying} onClick={() => void pay(c)}>
                  Pay {formatMoney(c.budget_minor, c.currency)}
                </Button>
              )}
              {c.status === "active" && (
                <Button
                  variant="secondary"
                  leading={<Pause size={16} />}
                  loading={act.isPending}
                  onClick={() =>
                    act.mutate({ id: c.id, action: "pause" }, { onError: (e) => toast.error(errorMessage(e)) })
                  }
                >
                  Pause
                </Button>
              )}
              {c.status === "paused" && (
                <Button
                  leading={<Play size={16} />}
                  loading={act.isPending}
                  onClick={() =>
                    act.mutate({ id: c.id, action: "resume" }, { onError: (e) => toast.error(errorMessage(e)) })
                  }
                >
                  Resume
                </Button>
              )}
            </div>
          </div>
        </Card>
        {live && (
          <Card>
            <h2 style={{ fontSize: "var(--text-lg)", marginTop: 0 }}>Results</h2>
            {stats.isPending ? (
              <Spinner />
            ) : stats.isError ? (
              <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
            ) : (
              <dl className={styles.stats}>
                <div>
                  <dt>Views</dt>
                  <dd>{formatCount(stats.data.impressions)}</dd>
                </div>
                <div>
                  <dt>Clicks</dt>
                  <dd>{formatCount(stats.data.clicks)}</dd>
                </div>
                <div>
                  <dt>Click rate</dt>
                  <dd>{(stats.data.click_through_rate * 100).toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Spent</dt>
                  <dd>
                    {formatMoney(stats.data.spent_minor, stats.data.currency)}
                    <span className="muted" style={{ fontSize: "var(--text-sm)", fontWeight: 400 }}>
                      {" "}
                      of {formatMoney(stats.data.budget_minor, stats.data.currency)}
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
