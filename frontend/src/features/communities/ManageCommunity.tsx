import { ScopeStats } from "@/components/AnalyticsReport";
import { Link2, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import {
  type CommunityMember,
  type CommunityUpdate,
  type InviteLink,
  type MemberAction,
  useAnswerInvitation,
  useCommunityPeople,
  useCreateInviteLink,
  useDeleteCommunity,
  useInviteToCommunity,
  useJoinWithCode,
  useMemberAction,
  useMyCommunityInvitations,
  useRevokeInviteLink,
  useSetMemberRole,
  useSetOfficial,
  useTransferCommunity,
  useUpdateCommunity,
} from "@/api/queries/communityAdmin";
import { useCommunity } from "@/api/queries/communities";
import { can, usePermissions } from "@/api/queries/institutions";
import type { Community } from "@/api/types";
import { ActionButton, NoAccess, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { PageHeader } from "@/components/PageHeader";
import { PersonPicker } from "@/components/PersonPicker";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useCopy } from "@/components/ui/useCopy";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";

const RANK: Record<string, number> = { member: 0, moderator: 1, admin: 2, owner: 3 };

function PersonCell({ member }: { member: CommunityMember }) {
  const u = member.user;
  return (
    <span className="cluster" style={{ "--cluster-gap": "var(--space-2)", flex: "1 1 14rem" } as React.CSSProperties}>
      <Avatar name={u.display_name} seed={u.id} src={u.avatar_url} size="sm" />
      <span className={m.itemMain}>
        {u.handle ? <Link to={`/u/${u.handle}`}>{u.display_name}</Link> : <strong>{u.display_name}</strong>}
        <span className={m.small}>
          {humanize(member.role)}
          {member.joined_at && ` · joined ${timeAgo(member.joined_at)}`}
        </span>
      </span>
    </span>
  );
}

function Members({ community, myRole }: { community: Community; myRole: string }) {
  const [role, setRole] = useState("");
  const members = useCommunityPeople(community.id, "members", role);
  const act = useMemberAction(community.id);
  const setRoleMutation = useSetMemberRole(community.id);
  const transfer = useTransferCommunity(community.id);
  const toast = useToast();
  const run = (userId: string, action: MemberAction) => (reason: string) => act.mutateAsync({ userId, action, reason });
  return (
    <Section title="Members">
      <label htmlFor="member-role" className="visually-hidden">
        Role
      </label>
      <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: "14rem" }}>
        <option value="">Everyone</option>
        {["owner", "admin", "moderator", "member"].map((r) => (
          <option key={r} value={r}>
            {humanize(r)}s
          </option>
        ))}
      </Select>
      {members.isPending ? (
        <Spinner />
      ) : members.isError ? (
        <ErrorState error={members.error} />
      ) : (
        <ul className={m.list}>
          {members.data.map((mem) => {
            const outranks = RANK[myRole]! > RANK[mem.role]!;
            return (
              <li key={mem.user.id} className={m.item}>
                <PersonCell member={mem} />
                {outranks && (
                  <div className={m.rowActions}>
                    <Select
                      aria-label={`Role for ${mem.user.display_name}`}
                      value={mem.role}
                      onChange={(e) =>
                        setRoleMutation.mutate(
                          { userId: mem.user.id, role: e.target.value as "admin" | "moderator" | "member" },
                          {
                            onSuccess: () => toast.success("Role updated"),
                            onError: (err) => toast.error(errorMessage(err)),
                          },
                        )
                      }
                    >
                      {(myRole === "owner" ? ["admin", "moderator", "member"] : ["moderator", "member"]).map((r) => (
                        <option key={r} value={r}>
                          {humanize(r)}
                        </option>
                      ))}
                    </Select>
                    <ActionButton reason="Reason (optional)" run={run(mem.user.id, "remove")} success="Removed">
                      Remove
                    </ActionButton>
                    <ActionButton variant="danger" reason="Reason" run={run(mem.user.id, "ban")} success="Banned">
                      Ban
                    </ActionButton>
                    {myRole === "owner" && (
                      <ActionButton
                        confirm={`Make ${mem.user.display_name} the owner? You'll become an admin.`}
                        run={() => transfer.mutateAsync(mem.user.id)}
                        success="Ownership transferred"
                      >
                        Make owner
                      </ActionButton>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Requests({ community }: { community: Community }) {
  const requests = useCommunityPeople(community.id, "requests");
  const act = useMemberAction(community.id);
  return (
    <Section title="Join requests" description="People asking to join. Approving makes them members.">
      {requests.isPending ? (
        <Spinner />
      ) : (requests.data ?? []).length === 0 ? (
        <p className="muted">No requests waiting.</p>
      ) : (
        <ul className={m.list}>
          {requests.data!.map((r) => (
            <li key={r.user.id} className={m.item}>
              <PersonCell member={r} />
              <div className={m.rowActions}>
                <ActionButton
                  variant="primary"
                  run={() => act.mutateAsync({ userId: r.user.id, action: "approve" })}
                  success="Approved"
                >
                  Approve
                </ActionButton>
                <ActionButton run={() => act.mutateAsync({ userId: r.user.id, action: "decline" })} success="Declined">
                  Decline
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Bans({ community }: { community: Community }) {
  const bans = useCommunityPeople(community.id, "bans");
  const act = useMemberAction(community.id);
  return (
    <Section title="Banned">
      {bans.isPending ? (
        <Spinner />
      ) : (bans.data ?? []).length === 0 ? (
        <p className="muted">Nobody is banned.</p>
      ) : (
        <ul className={m.list}>
          {bans.data!.map((b) => (
            <li key={b.user.id} className={m.item}>
              <PersonCell member={b} />
              <ActionButton run={() => act.mutateAsync({ userId: b.user.id, action: "unban" })} success="Unbanned">
                Unban
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Invites({ community }: { community: Community }) {
  const invite = useInviteToCommunity(community.id);
  const createLink = useCreateInviteLink(community.id);
  const revoke = useRevokeInviteLink(community.id);
  const toast = useToast();
  const copy = useCopy();
  const [hours, setHours] = useState("168");
  const [maxUses, setMaxUses] = useState("");
  const [links, setLinks] = useState<InviteLink[]>([]);
  const url = (code: string) => `${window.location.origin}/join/${code}`;
  return (
    <>
      <Section title="Invite someone" description="They get a notification and can accept from their invitations.">
        <PersonPicker
          label="Who?"
          action="Invite"
          onPick={(p) =>
            invite.mutate(p.id, {
              onSuccess: () => toast.success(`Invited ${p.display_name}`),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      </Section>
      <Section
        title="Invite links"
        description="Anyone with the link can join, even a private community. Links are shown only once: copy them now."
      >
        <form
          className="cluster"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createLink.mutate(
              { expires_in_hours: Number(hours), max_uses: maxUses ? Number(maxUses) : null },
              { onSuccess: (link) => setLinks((l) => [link, ...l]), onError: (err) => toast.error(errorMessage(err)) },
            );
          }}
        >
          <Field label="Expires after">
            <Select value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="24">1 day</option>
              <option value="168">1 week</option>
              <option value="720">30 days</option>
            </Select>
          </Field>
          <Field label="Max uses" optional>
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </Field>
          <Button type="submit" loading={createLink.isPending} leading={<Link2 size={16} />}>
            Create link
          </Button>
        </form>
        <ul className={m.list}>
          {links.map((l) => (
            <li key={l.id} className={m.item}>
              <div className={m.itemMain}>
                <code style={{ overflowWrap: "anywhere" }}>{url(l.code)}</code>
                <span className={m.small}>
                  Expires {formatDateTime(l.expires_at)}
                  {l.max_uses ? ` · up to ${l.max_uses} people` : ""}
                </span>
              </div>
              <div className={m.rowActions}>
                <Button size="sm" onClick={() => void copy(url(l.code), "Link copied")}>
                  Copy
                </Button>
                <ActionButton
                  variant="danger"
                  run={async () => {
                    await revoke.mutateAsync(l.id);
                    setLinks((all) => all.filter((x) => x.id !== l.id));
                  }}
                  success="Link revoked"
                >
                  Revoke
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function SettingsTab({ community, myRole, staff }: { community: Community; myRole: string; staff: boolean }) {
  const update = useUpdateCommunity(community.id);
  const remove = useDeleteCommunity();
  const official = useSetOfficial(community.id);
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    name: community.name,
    description: community.description,
    rules: Array.isArray(community.rules) ? (community.rules as string[]).join("\n") : "",
    privacy: community.privacy,
    posting_policy: community.posting_policy,
    commenting_policy: community.commenting_policy,
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <>
      <Section title="Community settings">
        <form
          className={m.form}
          onSubmit={(e) => {
            e.preventDefault();
            const body: CommunityUpdate = {
              ...form,
              rules: form.rules
                .split("\n")
                .map((r) => r.trim())
                .filter(Boolean),
            };
            update.mutate(body, {
              onSuccess: () => toast.success("Saved"),
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        >
          <Field label="Name">
            <Input value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={set("description")} />
          </Field>
          <Field label="Rules" hint="One per line.">
            <Textarea rows={5} value={form.rules} onChange={set("rules")} />
          </Field>
          <div className={m.formRow}>
            <Field label="Who can join">
              <Select value={form.privacy} onChange={set("privacy")}>
                <option value="public">Anyone (public)</option>
                <option value="restricted">Anyone can ask; admins approve</option>
                <option value="private">Invite only (hidden)</option>
              </Select>
            </Field>
            <Field label="Who can post">
              <Select value={form.posting_policy} onChange={set("posting_policy")}>
                <option value="members">Members</option>
                <option value="moderators">Moderators and up</option>
                <option value="admins">Admins only (announcements)</option>
              </Select>
            </Field>
            <Field label="Who can comment">
              <Select value={form.commenting_policy} onChange={set("commenting_policy")}>
                <option value="members">Members</option>
                <option value="moderators">Moderators and up</option>
                <option value="admins">Admins only</option>
                <option value="disabled">Nobody</option>
              </Select>
            </Field>
          </div>
          <div>
            <Button type="submit" loading={update.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Section>
      {staff && (
        <Section
          title={
            <>
              <ShieldCheck size={18} aria-hidden /> Official community (GistLoop staff)
            </>
          }
        >
          <Checkbox
            label="Official: run by the school, department or organisation it represents"
            checked={community.is_official}
            onChange={(e) =>
              official.mutate(e.target.checked, {
                onSuccess: () => toast.success("Updated"),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          />
        </Section>
      )}
      {myRole === "owner" && (
        <Section title="Delete community">
          <ActionButton
            variant="danger"
            confirm={`Delete ${community.name}? Posts and gist go with it. This can't be undone.`}
            run={async () => {
              await remove.mutateAsync(community.id);
              navigate("/communities");
            }}
            success="Community deleted"
          >
            Delete community
          </ActionButton>
        </Section>
      )}
    </>
  );
}

type Tab = "members" | "requests" | "invites" | "bans" | "settings" | "stats";

/** /c/:communityId/manage */
export default function ManageCommunityPage() {
  const { communityId } = useParams();
  const community = useCommunity(communityId);
  const platform = usePermissions("platform", "");
  const scoped = usePermissions("community", communityId ?? "", Boolean(communityId));
  const [tab, setTab] = useState<Tab>("members");
  if (community.isPending) return <PageLoader />;
  if (community.isError) return <ErrorState error={community.error} />;
  const c = community.data;
  const myRole = ((c.viewer ?? {}) as { role?: string | null }).role ?? "";
  const staff = can(platform.data, "community.manage");
  if (!["owner", "admin", "moderator"].includes(myRole) && !staff) return <NoAccess />;
  const items: { value: Tab; label: string }[] = [
    { value: "members", label: "Members" },
    { value: "requests", label: "Requests" },
    { value: "invites", label: "Invite" },
    { value: "bans", label: "Banned" },
    ...(myRole === "owner" || myRole === "admin" || staff ? [{ value: "settings" as Tab, label: "Settings" }] : []),
    ...(can(scoped.data, "analytics.view") ? [{ value: "stats" as Tab, label: "Stats" }] : []),
  ];
  return (
    <div className="stack">
      <Seo title={`Manage ${c.name}`} noIndex />
      <PageHeader eyebrow={<Link to={`/c/${c.id}`}>← {c.name}</Link>} title={`Manage ${c.name}`} />
      <Tabs label="Manage" value={tab} onChange={setTab} items={items} />
      {tab === "members" && <Members community={c} myRole={staff && !myRole ? "admin" : myRole} />}
      {tab === "requests" && <Requests community={c} />}
      {tab === "invites" && <Invites community={c} />}
      {tab === "bans" && <Bans community={c} />}
      {tab === "settings" && <SettingsTab community={c} myRole={myRole} staff={staff} />}
      {tab === "stats" && (
        <Section title="Activity">
          <ScopeStats scopeType="community" scopeId={c.id} />
        </Section>
      )}
    </div>
  );
}

/** /communities/invitations: communities that invited you. */
export function CommunityInvitationsPage() {
  const invitations = useMyCommunityInvitations();
  const answer = useAnswerInvitation();
  return (
    <div className="stack">
      <Seo title="Community invitations" noIndex />
      <PageHeader eyebrow={<Link to="/communities">← Communities</Link>} title="Invitations" />
      <Card>
        {invitations.isPending ? (
          <Spinner />
        ) : invitations.isError ? (
          <ErrorState error={invitations.error} />
        ) : invitations.data.length === 0 ? (
          <EmptyState icon={Mail} title="No invitations" />
        ) : (
          <ul className={m.list}>
            {invitations.data.map((inv) => (
              <li key={inv.community.id} className={m.item}>
                <div className={m.itemMain}>
                  <Link to={`/c/${inv.community.id}`}>
                    <strong>{inv.community.name}</strong>
                  </Link>
                  <span className={m.small}>
                    {inv.community.member_count} members <StatusBadge status={inv.status} />
                  </span>
                </div>
                <div className={m.rowActions}>
                  <ActionButton
                    variant="primary"
                    run={() => answer.mutateAsync({ id: inv.community.id, accept: true })}
                    success="Joined!"
                  >
                    Join
                  </ActionButton>
                  <ActionButton
                    run={() => answer.mutateAsync({ id: inv.community.id, accept: false })}
                    success="Declined"
                  >
                    Decline
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** /join/:code: an invite link. */
export function JoinWithCodePage() {
  const { code = "" } = useParams();
  const join = useJoinWithCode();
  const navigate = useNavigate();
  const ran = useRef(false);
  const { mutate } = join;
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    mutate(code, { onSuccess: (membership) => navigate(`/c/${membership.community.id}`, { replace: true }) });
  }, [code, mutate, navigate]);
  return (
    <Card>
      <Seo title="Joining…" noIndex />
      {join.isError ? (
        <div className="stack">
          <Alert tone="error">{errorMessage(join.error)}</Alert>
          <Link to="/communities">Browse communities</Link>
        </div>
      ) : (
        <Spinner label="Joining the community" />
      )}
    </Card>
  );
}
