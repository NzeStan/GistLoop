import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, KeyRound, Link2, Phone, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router";

import { startOAuth } from "@/api/auth";
import { errorMessage } from "@/api/errors";
import {
  type ApiKeyCreated,
  useActivity,
  useApiKeys,
  useConfirmMfa,
  useConfirmPhone,
  useConsents,
  useCreateApiKey,
  useDisableMfa,
  useLinkedIdentities,
  useOAuthProviders,
  usePushDevices,
  useRegisterPushDevice,
  useRemovePhone,
  useRemovePushDevice,
  useRevokeApiKey,
  useSecuritySettings,
  useSetConsent,
  useStartMfa,
  useStartPhone,
  useUnlinkIdentity,
  useUnregisterPushToken,
  useUpdateSecuritySettings,
} from "@/api/queries/security";
import { useAuth } from "@/auth/AuthProvider";
import { LoadMore } from "@/components/LoadMore";
import m from "@/components/Manage.module.css";
import { ActionButton, DataTable, Section, StatusBadge } from "@/components/Manage";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert, Checkbox, Field, Input, Select } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useCopy } from "@/components/ui/useCopy";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";
import { browserPushActive, disableBrowserPush, enableBrowserPush, pushConfigured, pushSupported } from "@/lib/push";

// --------------------------------------------------------------- two-step sign-in
export function TwoStepSettings() {
  const { me } = useAuth();
  const settings = useSecuritySettings();
  const start = useStartMfa();
  const confirm = useConfirmMfa();
  const disable = useDisableMfa();
  const update = useUpdateSecuritySettings();
  const toast = useToast();
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [challenge, setChallenge] = useState<{ challenge_id: string; destination?: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  if (settings.isPending) return <Spinner />;
  if (settings.isError) return <ErrorState error={settings.error} />;
  const s = settings.data;
  return (
    <Section
      title={
        <>
          <ShieldCheck size={18} aria-hidden /> Two-step sign-in
        </>
      }
      description="After your password, we send a code to your email or phone. Someone with only your password can't get in."
    >
      {s.mfa_enabled ? (
        <div className="stack">
          <Alert tone="success">
            On, by {s.mfa_channel === "sms" ? "text message" : "email"}
            {s.mfa_enabled_at && ` since ${formatDateTime(s.mfa_enabled_at)}`}.
          </Alert>
          <form
            className="cluster"
            onSubmit={(e) => {
              e.preventDefault();
              disable.mutate(password, {
                onSuccess: () => (setPassword(""), toast.success("Two-step sign-in is off")),
                onError: (err) => toast.error(errorMessage(err)),
              });
            }}
          >
            <Field label="Your password, to turn it off">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="danger" loading={disable.isPending} disabled={!password}>
              Turn off
            </Button>
          </form>
        </div>
      ) : challenge ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate(
              { channel, challenge_id: challenge.challenge_id, code: code.trim() },
              {
                onSuccess: () => (setChallenge(null), setCode(""), toast.success("Two-step sign-in is on")),
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <Field label={`Code sent to ${challenge.destination ?? "you"}`}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <div className="cluster">
            <Button type="submit" loading={confirm.isPending}>
              Confirm
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChallenge(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="cluster">
          <label htmlFor="mfa-channel" className="visually-hidden">
            Send codes by
          </label>
          <Select id="mfa-channel" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms")}>
            <option value="email">Email ({me?.email})</option>
            <option value="sms" disabled={!me?.phone_verified}>
              Text message{me?.phone_verified ? ` (${me.phone_number})` : " (add a phone number first)"}
            </option>
          </Select>
          <Button
            loading={start.isPending}
            onClick={() =>
              start.mutate(channel, {
                onSuccess: (c) => setChallenge(c),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            Turn on
          </Button>
        </div>
      )}
      <Checkbox
        label="Email me when there's a new sign-in to my account"
        checked={Boolean(s.login_alerts_enabled)}
        onChange={(e) =>
          update.mutate(
            { login_alerts_enabled: e.target.checked },
            { onSuccess: () => toast.success("Saved"), onError: (err) => toast.error(errorMessage(err)) },
          )
        }
      />
    </Section>
  );
}

// ------------------------------------------------------------------- phone number
export function PhoneSettings() {
  const { me } = useAuth();
  const start = useStartPhone();
  const confirm = useConfirmPhone();
  const remove = useRemovePhone();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<{ challenge_id: string } | null>(null);
  const [code, setCode] = useState("");
  const send = (event: FormEvent) => {
    event.preventDefault();
    start.mutate(phone.trim(), { onSuccess: (c) => setChallenge(c), onError: (err) => toast.error(errorMessage(err)) });
  };
  return (
    <Section
      title={
        <>
          <Phone size={18} aria-hidden /> Phone number
        </>
      }
      description="For sign-in codes by text and two-step sign-in. Never shown on your profile unless you choose to."
    >
      {me?.phone_number && !challenge ? (
        <div className="cluster" style={{ justifyContent: "space-between" }}>
          <span>
            {me.phone_number}{" "}
            {me.phone_verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
          </span>
          <ActionButton
            variant="danger"
            confirm="Remove your phone number?"
            run={() => remove.mutateAsync()}
            success="Removed"
          >
            Remove
          </ActionButton>
        </div>
      ) : challenge ? (
        <form
          className="cluster"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate(
              { phone_number: phone.trim(), challenge_id: challenge.challenge_id, code: code.trim() },
              {
                onSuccess: () => (setChallenge(null), setCode(""), toast.success("Phone number verified")),
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <Field label={`Code texted to ${phone}`}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={confirm.isPending}>
            Verify
          </Button>
        </form>
      ) : (
        <form className="cluster" onSubmit={send}>
          <Field label="Phone number" hint="With the country code, e.g. +2348012345678">
            <Input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Button type="submit" loading={start.isPending} disabled={phone.trim().length < 8}>
            Send code
          </Button>
        </form>
      )}
    </Section>
  );
}

// ------------------------------------------------------------- linked providers
export function LinkedAccounts() {
  const linked = useLinkedIdentities();
  const providers = useOAuthProviders();
  const unlink = useUnlinkIdentity();
  const toast = useToast();
  const [params] = useSearchParams();
  const available = (providers.data ?? []).filter((p) => !linked.data?.some((l) => l.provider === p.key));
  const name = (key: string) => providers.data?.find((p) => p.key === key)?.name ?? humanize(key);
  if (!providers.data?.length && !linked.data?.length) return null;
  return (
    <Section
      title={
        <>
          <Link2 size={18} aria-hidden /> Sign in with Google, Yahoo or GitHub
        </>
      }
      description="Linked accounts let you sign in with one click. You can unlink them any time."
    >
      {params.get("linked") && <Alert tone="success">Account linked.</Alert>}
      {linked.isPending ? (
        <Spinner />
      ) : (
        <ul className={m.list}>
          {linked.data?.map((l) => (
            <li key={l.id} className={m.item}>
              <div className={m.itemMain}>
                <strong>{name(l.provider)}</strong>
                <span className={m.small}>
                  {l.email} · linked {timeAgo(l.created_at)}
                  {l.last_login_at && ` · last used ${timeAgo(l.last_login_at)}`}
                </span>
              </div>
              <ActionButton
                confirm={`Unlink ${name(l.provider)}? You'll need your password (or another linked account) to sign in.`}
                run={() => unlink.mutateAsync(l.id)}
                success="Unlinked"
              >
                Unlink
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <div className="cluster">
          {available.map((p) => (
            <Button
              key={p.key}
              variant="secondary"
              onClick={() => startOAuth(p.key, "link", "/settings/security").catch((e) => toast.error(errorMessage(e)))}
            >
              Link {p.name}
            </Button>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------- activity
export function ActivityLog() {
  const activity = useActivity();
  const rows = activity.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <Section
      title="Recent account activity"
      description="Sign-ins, password and email changes and other security events."
    >
      {activity.isPending ? (
        <Spinner />
      ) : activity.isError ? (
        <ErrorState error={activity.error} />
      ) : (
        <>
          <DataTable
            caption="Account activity"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { header: "What", cell: (r) => humanize(r.action.replace(/\./g, " ")) },
              {
                header: "Result",
                cell: (r) => (
                  <StatusBadge status={r.outcome === "success" ? "completed" : "failed"} label={humanize(r.outcome)} />
                ),
              },
              { header: "When", cell: (r) => formatDateTime(r.created_at) },
              {
                header: "Where",
                cell: (r) => (
                  <span className={m.small}>
                    {[r.ip_address, r.user_agent.slice(0, 60)].filter(Boolean).join(" · ")}
                  </span>
                ),
              },
            ]}
          />
          <LoadMore
            hasMore={activity.hasNextPage}
            loading={activity.isFetchingNextPage}
            onLoad={() => void activity.fetchNextPage()}
          />
        </>
      )}
    </Section>
  );
}

// ----------------------------------------------------------------------- API keys
export function ApiKeys() {
  const keys = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const copy = useCopy();
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("");
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  return (
    <Section
      title={
        <>
          <KeyRound size={18} aria-hidden /> API keys (developers)
        </>
      }
      description="For your own scripts and apps: a key acts as you, with your permissions. Keep it secret."
    >
      {created && (
        <Alert tone="warning">
          Copy your new key now. You won't see it again.
          <code style={{ display: "block", margin: "var(--space-2) 0", overflowWrap: "anywhere" }}>{created.key}</code>
          <Button size="sm" onClick={() => void copy(created.key, "Key copied")}>
            Copy key
          </Button>
        </Alert>
      )}
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { name: name.trim(), scopes: ["*"], expires_at: expires ? new Date(expires).toISOString() : null },
            { onSuccess: (k) => (setCreated(k), setName(""), setExpires("")) },
          );
        }}
      >
        <Field label="Name">
          <Input
            value={name}
            maxLength={100}
            placeholder="e.g. My timetable bot"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Expires" optional>
          <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          Create key
        </Button>
      </form>
      {create.isError && <Alert tone="error">{errorMessage(create.error)}</Alert>}
      {keys.isPending ? (
        <Spinner />
      ) : (
        <ul className={m.list}>
          {keys.data
            ?.filter((k) => !k.revoked_at)
            .map((k) => (
              <li key={k.id} className={m.item}>
                <div className={m.itemMain}>
                  <strong>{k.name}</strong>
                  <span className={m.small}>
                    {k.lookup}… · created {timeAgo(k.created_at)}
                    {k.last_used_at ? ` · last used ${timeAgo(k.last_used_at)}` : " · never used"}
                    {k.expires_at && ` · expires ${formatDateTime(k.expires_at)}`}
                  </span>
                </div>
                <ActionButton
                  variant="danger"
                  confirm={`Revoke "${k.name}"? Anything using it stops working.`}
                  run={() => revoke.mutateAsync(k.id)}
                  success="Revoked"
                >
                  Revoke
                </ActionButton>
              </li>
            ))}
        </ul>
      )}
    </Section>
  );
}

// ----------------------------------------------------------------------- consents
export function ConsentSettings() {
  const consents = useConsents();
  const set = useSetConsent();
  const toast = useToast();
  if (consents.isPending) return <Spinner />;
  const c = consents.data ?? {};
  return (
    <Section title="Your agreements" description="What you've agreed to, and when.">
      <ul className={m.list}>
        {["terms_of_service", "privacy_policy"].map((purpose) => (
          <li key={purpose} className={m.item}>
            <div className={m.itemMain}>
              <strong>{humanize(purpose)}</strong>
              <span className={m.small}>
                {c[purpose]?.granted
                  ? `Agreed ${formatDateTime(c[purpose]!.recorded_at)} (version ${c[purpose]!.version || "–"})`
                  : "Not recorded"}
              </span>
            </div>
          </li>
        ))}
        <li className={m.item}>
          <Checkbox
            label="Send me news and offers from GistLoop (you can stop any time)"
            checked={Boolean(c.marketing?.granted)}
            onChange={(e) =>
              set.mutate(
                { purpose: "marketing", granted: e.target.checked },
                { onSuccess: () => toast.success("Saved"), onError: (err) => toast.error(errorMessage(err)) },
              )
            }
          />
        </li>
      </ul>
    </Section>
  );
}

// ------------------------------------------------------------------ push devices
export function PushSettings() {
  const devices = usePushDevices();
  const register = useRegisterPushDevice();
  const remove = useRemovePushDevice();
  const unregister = useUnregisterPushToken();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const active = useQuery({ queryKey: ["browserPush"], queryFn: browserPushActive });
  const enable = async () => {
    setBusy(true);
    try {
      const token = await enableBrowserPush();
      await register.mutateAsync({
        platform: "web",
        token,
        name: navigator.userAgent.includes("Mobile") ? "Phone browser" : "Web browser",
      });
      toast.success("Notifications are on for this browser");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["browserPush"] });
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const token = await disableBrowserPush();
      if (token) await unregister.mutateAsync(token);
      toast.success("Notifications are off for this browser");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["browserPush"] });
    }
  };
  return (
    <Section
      title={
        <>
          <BellRing size={18} aria-hidden /> Push notifications
        </>
      }
      description="Get notified on this device even when GistLoop isn't open. Choose which kinds above."
    >
      {!pushConfigured ? (
        <p className="muted">Push notifications aren't set up on this site yet.</p>
      ) : !pushSupported() ? (
        <p className="muted">
          This browser doesn't support push notifications. On iPhone, add GistLoop to your home screen first.
        </p>
      ) : active.data ? (
        <Button variant="secondary" loading={busy} onClick={() => void disable()}>
          Turn off for this browser
        </Button>
      ) : (
        <Button loading={busy} onClick={() => void enable()}>
          Turn on for this browser
        </Button>
      )}
      {devices.data && devices.data.length > 0 && (
        <ul className={m.list}>
          {devices.data.map((d) => (
            <li key={d.id} className={m.item}>
              <div className={m.itemMain}>
                <strong>
                  {d.name || humanize(d.platform)} <span className={m.small}>…{d.token_suffix}</span>
                </strong>
                <span className={m.small}>
                  {humanize(d.platform)} · added {timeAgo(d.created_at)} · {d.active ? "active" : "turned off"}
                </span>
              </div>
              <ActionButton run={() => remove.mutateAsync(d.id)} success="Removed">
                Remove
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
