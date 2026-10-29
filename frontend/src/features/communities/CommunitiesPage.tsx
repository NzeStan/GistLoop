import { Plus, ShieldCheck, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import { useCommunities, useCreateCommunity } from "@/api/queries/communities";
import type { Community } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader, PageHero } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Skeleton } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import styles from "@/features/content/Browse.module.css";
import { useDebounced } from "@/lib/hooks";
import { pluralize } from "@/lib/format";

export function CommunityCard({ community }: { community: Community }) {
  return (
    <Card padded={false} interactive>
      <Link to={`/c/${community.id}`} className={styles.tile}>
        <div className={styles.tileBody}>
          <div className={styles.communityHead}>
            <span className={styles.communityIcon} aria-hidden>
              {community.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h3 className={styles.tileTitle}>{community.name}</h3>
              {community.is_official && (
                <Badge tone="primary">
                  <ShieldCheck size={12} aria-hidden /> Official
                </Badge>
              )}
            </div>
          </div>
          <p className={styles.tileText}>{community.description || "A GistLoop community."}</p>
          <div className={styles.tileMeta}>
            <span className={styles.metaItem}>
              <Users size={15} aria-hidden /> {pluralize(community.member_count, "member")}
            </span>
            {community.privacy !== "public" && (
              <Badge>{community.privacy === "private" ? "Private" : "Approval needed"}</Badge>
            )}
            {community.viewer && (community.viewer as { status?: string }).status === "active" && (
              <Badge tone="success">Joined</Badge>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}

function CreateCommunityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCommunity();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "restricted" | "private">("public");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name, description, privacy }, { onSuccess: (community) => navigate(`/c/${community.id}`) });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Start a community">
      <form className="stack" onSubmit={onSubmit}>
        {create.isError && !(create.error instanceof ApiError && create.error.fieldErrors.name) && (
          <Alert tone="error">{errorMessage(create.error)}</Alert>
        )}
        <Field label="Name" error={create.error instanceof ApiError ? create.error.fieldErrors.name : undefined}>
          <Input
            required
            minLength={3}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lagos Book Club"
          />
        </Field>
        <Field label="What's it about?" optional>
          <Textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Who can join?" hint="Private communities are hidden from people who aren't members.">
          <Select value={privacy} onChange={(e) => setPrivacy(e.target.value as typeof privacy)}>
            <option value="public">Anyone</option>
            <option value="restricted">Anyone can ask; admins approve</option>
            <option value="private">Invite only</option>
          </Select>
        </Field>
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={name.trim().length < 3}>
            Create community
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function CommunitiesPage() {
  const { status } = useAuth();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const query = useCommunities(useDebounced(q));
  const signedIn = status === "signed-in";

  const header = signedIn ? (
    <PageHeader
      title="Communities"
      description="Find your people: courses, clubs, faiths, fandoms and everything in between."
      actions={
        <Button leading={<Plus size={16} />} onClick={() => setCreating(true)}>
          New community
        </Button>
      }
    />
  ) : (
    <PageHero
      eyebrow="Communities"
      title="Find your people"
      description="Courses, clubs, faiths, fandoms and everything in between. Join a community to post, chat and share anonymous gist."
    >
      <ButtonLink to="/register" size="lg">
        Join GistLoop free
      </ButtonLink>
    </PageHero>
  );

  return (
    <>
      <Seo title="Communities" description="Discover GistLoop communities for every course, club and interest." />
      {header}
      <div
        className={signedIn ? undefined : "container section"}
        style={signedIn ? undefined : { paddingTop: "var(--space-8)" }}
      >
        <div className={styles.toolbar}>
          <label htmlFor="community-search" className="visually-hidden">
            Search communities
          </label>
          <Input
            id="community-search"
            type="search"
            placeholder="Search communities"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {query.isPending ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height="11rem" radius="var(--radius-lg)" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.results.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? `No communities match “${q}”` : "No communities yet"}
            action={signedIn ? <Button onClick={() => setCreating(true)}>Start one</Button> : undefined}
          >
            {q ? "Try another search." : "Be the first to start one."}
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {query.data.results.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        )}
      </div>
      {signedIn && <CreateCommunityDialog open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}
