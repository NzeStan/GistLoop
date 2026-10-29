import { BadgeCheck, MapPin, Package, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { type ListingFilters, useListing, useListings, useMarketCategories } from "@/api/queries/marketplace";
import type { Listing } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { Img } from "@/components/ui/Img";
import { PageLoader, Skeleton } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { brand } from "@/config/brand";
import styles from "@/features/content/Browse.module.css";
import { BrowseShell } from "@/features/content/BrowseShell";
import { Sponsored } from "@/features/promotions/Sponsored";
import { useDebounced } from "@/lib/hooks";

import { BuyPanel } from "./BuyPanel";
import { formatMoney, humanize, timeAgo } from "@/lib/format";

export function ListingCard({ listing }: { listing: Listing }) {
  const image = listing.images[0];
  return (
    <Card padded={false} interactive>
      <Link to={`/marketplace/${listing.id}`} className={styles.tile}>
        <Img
          src={image?.url}
          fallback={brand.assets.fallbacks.listing}
          alt={image?.alt_text ?? ""}
          className={`${styles.tileMedia} ${styles.tileMediaSquare}`}
        />
        <div className={styles.tileBody}>
          <span className={styles.price}>{formatMoney(listing.price_minor, listing.currency)}</span>
          <h3 className={styles.tileTitle} style={{ fontSize: "var(--text-base)" }}>
            {listing.title}
          </h3>
          <div className={styles.tileMeta}>
            <Badge>{humanize(listing.condition)}</Badge>
            {listing.city && (
              <span className={styles.metaItem}>
                <MapPin size={14} aria-hidden /> {listing.city}
              </span>
            )}
            {listing.status === "sold_out" && <Badge tone="danger">Sold out</Badge>}
          </div>
        </div>
      </Link>
    </Card>
  );
}

export default function MarketplacePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<ListingFilters["condition"] | "">("");
  const [sort, setSort] = useState("");
  const { status } = useAuth();
  const categories = useMarketCategories();
  const listings = useListings({ q: useDebounced(q), category, condition: condition || undefined, sort });

  return (
    <BrowseShell
      eyebrow="Marketplace"
      title="Buy and sell on campus, safely"
      description="Textbooks, gadgets, fashion and services from students near you, with payments held in escrow until you confirm delivery."
      actions={
        status === "signed-in" ? (
          <div className="cluster">
            <ButtonLink to="/marketplace/orders" variant="secondary">
              Orders
            </ButtonLink>
            <ButtonLink to="/marketplace/sell">Sell something</ButtonLink>
          </div>
        ) : undefined
      }
    >
      <Seo
        title="Marketplace"
        description="Buy and sell textbooks, gadgets and more with students near you on GistLoop."
      />
      <div className={styles.toolbar}>
        <label htmlFor="market-search" className="visually-hidden">
          Search listings
        </label>
        <Input
          id="market-search"
          type="search"
          placeholder="Search the marketplace"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label htmlFor="market-category" className="visually-hidden">
          Category
        </label>
        <Select id="market-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </Select>
        <label htmlFor="market-condition" className="visually-hidden">
          Condition
        </label>
        <Select
          id="market-condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ListingFilters["condition"] | "")}
        >
          <option value="">Any condition</option>
          <option value="new">New</option>
          <option value="like_new">Like new</option>
          <option value="used">Used</option>
        </Select>
        <label htmlFor="market-sort" className="visually-hidden">
          Sort by
        </label>
        <Select id="market-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Newest</option>
          <option value="price">Price: low to high</option>
          <option value="-price">Price: high to low</option>
        </Select>
      </div>
      <Sponsored placement="marketplace" />
      {listings.isPending ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height="20rem" radius="var(--radius-lg)" />
          ))}
        </div>
      ) : listings.isError ? (
        <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
      ) : listings.data.results.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No listings found">
          Try a different search or category.
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {listings.data.results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </BrowseShell>
  );
}

export function ListingPage() {
  const { listingId } = useParams();
  const { status } = useAuth();
  const listing = useListing(listingId);
  const [active, setActive] = useState(0);

  if (listing.isPending) return <PageLoader />;
  if (listing.isError) return <ErrorState error={listing.error} onRetry={() => void listing.refetch()} />;
  const l = listing.data;
  const images = l.images;

  return (
    <article>
      <Seo title={l.title} description={l.description.slice(0, 160)} image={images[0]?.url} />
      <div className={styles.detailLayout} style={{ marginTop: 0 }}>
        <div className="stack">
          <Img
            src={images[active]?.url}
            fallback={brand.assets.fallbacks.listing}
            alt={images[active]?.alt_text ?? l.title}
            className={styles.mainImage}
            loading="eager"
          />
          {images.length > 1 && (
            <div className={styles.gallery}>
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show image ${index + 1}`}
                  style={{ padding: 0, border: 0, background: "none" }}
                >
                  <img src={image.url} alt="" />
                </button>
              ))}
            </div>
          )}
          <Card>
            <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>Description</h2>
            <p className="pre-wrap">{l.description || "No description provided."}</p>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <div className="stack" style={{ "--stack-gap": "var(--space-3)" } as React.CSSProperties}>
              <h1 style={{ fontSize: "var(--text-2xl)" }}>{l.title}</h1>
              <span className={styles.price} style={{ fontSize: "var(--text-3xl)" }}>
                {formatMoney(l.price_minor, l.currency)}
              </span>
              <div className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
                <Badge>{humanize(l.condition)}</Badge>
                <Badge tone="primary">{l.category.name}</Badge>
                {l.quantity > 1 && <Badge>{l.quantity} available</Badge>}
              </div>
              <ul className={styles.facts}>
                {l.city && (
                  <li>
                    <MapPin size={18} aria-hidden /> {l.city}
                    {l.location_note && ` · ${l.location_note}`}
                  </li>
                )}
                {l.allows_pickup && (
                  <li>
                    <Package size={18} aria-hidden /> Pickup available
                    {l.allows_cash_on_pickup ? " (cash on pickup accepted)" : ""}
                  </li>
                )}
                {l.allows_delivery && (
                  <li>
                    <Truck size={18} aria-hidden /> Delivery{" "}
                    {l.delivery_fee_minor ? `for ${formatMoney(l.delivery_fee_minor, l.currency)}` : "included"}
                  </li>
                )}
                <li>
                  <ShieldCheck size={18} aria-hidden /> Online payments are held in escrow until you confirm you've
                  received the item.
                </li>
              </ul>
              {status === "signed-in" ? (
                <BuyPanel listing={l} />
              ) : (
                <ButtonLink to={`/login?next=/marketplace/${l.id}`} block size="lg">
                  Sign in to buy
                </ButtonLink>
              )}
            </div>
          </Card>
          {l.seller && (
            <Card>
              <h2 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>Seller</h2>
              <Link
                to={l.seller.handle ? `/u/${l.seller.handle}` : "#"}
                className="cluster"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Avatar name={l.seller.display_name} seed={l.seller.id} src={l.seller.avatar_url} />
                <span>
                  <strong style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                    {l.seller.display_name}{" "}
                    <BadgeCheck size={14} aria-hidden style={{ color: "var(--color-primary)" }} />
                  </strong>
                  <span className="muted">
                    Listed {l.published_at ? timeAgo(l.published_at) : timeAgo(l.created_at)}
                  </span>
                </span>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </article>
  );
}
