import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Download, LogOut, Monitor, Smartphone, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { ApiError, errorMessage } from "@/api/errors";
import {
  downloadMyData,
  useChangeEmail,
  useChangePassword,
  useDeleteAccount,
  useNotificationCategories,
  useNotificationSettings,
  usePrivacy,
  useRemoveAvatar,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useSocialProfile,
  useUpdateMe,
  useUpdateNotificationSettings,
  useUpdatePrivacy,
  useUpdateSocialProfile,
  useUploadAvatar,
} from "@/api/queries/account";
import { sessionEnded } from "@/api/auth";
import { useAuth } from "@/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, timeAgo } from "@/lib/format";

import styles from "./Settings.module.css";
import { passwordSchema } from "../auth/schemas";

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? styles.danger : undefined}>
      <section className={styles.section}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </section>
    </Card>
  );
}

// ------------------------------------------------------------------ profile
const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your name").max(100),
  handle: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only"),
  bio: z.string().max(300, "Keep it under 300 characters"),
  website: z.union([z.literal(""), z.url("Enter a full link, e.g. https://example.com")]),
});
type ProfileForm = z.infer<typeof profileSchema>;

export function ProfileSettings() {
  const { me } = useAuth();
  const social = useSocialProfile();
  const updateMe = useUpdateMe();
  const updateSocial = useUpdateSocialProfile();
  const toast = useToast();
  const form = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (me && social.data) {
      form.reset({
        display_name: me.display_name ?? "",
        handle: me.handle ?? "",
        bio: social.data.bio ?? "",
        website: social.data.website ?? "",
      });
    }
  }, [me, social.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateMe.mutateAsync({ display_name: values.display_name, handle: values.handle });
      await updateSocial.mutateAsync({ bio: values.bio, website: values.website || "" });
      toast.success("Profile saved");
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          form.setError(field as keyof ProfileForm, { message });
        }
      }
      toast.error(errorMessage(error));
    }
  });

  if (social.isPending) return <Spinner />;
  const { errors, isSubmitting } = form.formState;
  return (
    <>
      <PhotoSettings />
      <Section title="Public profile" description="This is how others see you on GistLoop.">
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <Field label="Name" error={errors.display_name?.message}>
            <Input autoComplete="name" {...form.register("display_name")} />
          </Field>
          <Field label="Username" hint="Your profile link: gistloop/u/username" error={errors.handle?.message}>
            <Input autoComplete="username" {...form.register("handle")} />
          </Field>
          <Field label="Bio" optional error={errors.bio?.message}>
            <Textarea maxLength={300} {...form.register("bio")} />
          </Field>
          <Field label="Website" optional error={errors.website?.message}>
            <Input type="url" placeholder="https://" {...form.register("website")} />
          </Field>
          <div className={styles.formActions}>
            <Button type="submit" loading={isSubmitting}>
              Save profile
            </Button>
          </div>
        </form>
      </Section>
    </>
  );
}

function PhotoSettings() {
  const { me } = useAuth();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const toast = useToast();
  return (
    <Section
      title="Profile photo"
      description="JPEG, PNG or WebP, up to 5 MB. We crop it square and remove location data from it."
    >
      <div className="cluster">
        <Avatar name={me?.display_name} seed={me?.id} src={me?.avatar_url} size="xl" />
        <FilePicker
          leading={<Camera size={16} />}
          loading={upload.isPending}
          onPick={([file]) =>
            file &&
            upload.mutate(file, {
              onSuccess: () => toast.success("Photo updated"),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        >
          {me?.avatar_url ? "Change photo" : "Upload a photo"}
        </FilePicker>
        {me?.avatar_url && (
          <Button
            variant="ghost"
            leading={<Trash2 size={16} />}
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => toast.success("Photo removed"),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ account
export function AccountSettings() {
  const { me } = useAuth();
  const changeEmail = useChangeEmail();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    changeEmail.mutate(
      { new_email: email, password },
      {
        onSuccess: () => {
          toast.success("Check your new inbox to confirm the change.");
          setEmail("");
          setPassword("");
        },
      },
    );
  };
  return (
    <>
      <Section title="Email address" description="We'll send a confirmation link to your new address before switching.">
        <p style={{ marginBottom: "var(--space-4)" }}>
          Current: <strong>{me?.email}</strong>{" "}
          {me?.email_verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
          {me?.pending_email && (
            <span className="muted">
              {" "}
              · Waiting for confirmation of <strong>{me.pending_email}</strong>
            </span>
          )}
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          {changeEmail.isError && <Alert tone="error">{errorMessage(changeEmail.error)}</Alert>}
          <Field label="New email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Current password" hint="To confirm it's really you.">
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className={styles.formActions}>
            <Button type="submit" loading={changeEmail.isPending}>
              Change email
            </Button>
          </div>
        </form>
      </Section>
      <ChangePassword />
    </>
  );
}

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

function ChangePassword() {
  const change = useChangePassword();
  const toast = useToast();
  const form = useForm<z.infer<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema) });
  const onSubmit = form.handleSubmit(async ({ current_password, new_password }) => {
    try {
      await change.mutateAsync({ current_password, new_password });
      form.reset({ current_password: "", new_password: "", confirm: "" });
      toast.success("Password changed. Your other devices have been signed out.");
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          form.setError(field as "current_password" | "new_password", { message });
        }
      }
      toast.error(errorMessage(error));
    }
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <Section title="Password" description="Changing your password signs you out everywhere else.">
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <Field label="Current password" error={errors.current_password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register("current_password")} />
        </Field>
        <Field
          label="New password"
          hint="At least 10 characters. Avoid common words."
          error={errors.new_password?.message}
        >
          <Input type="password" autoComplete="new-password" {...form.register("new_password")} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <div className={styles.formActions}>
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ------------------------------------------------------------------ privacy
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={styles.toggleRow}>
      <span>
        <strong style={{ display: "block", fontSize: "var(--text-sm)" }}>{label}</strong>
        {description && (
          <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
            {description}
          </span>
        )}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function PrivacySettings() {
  const privacy = usePrivacy();
  const update = useUpdatePrivacy();
  const social = useSocialProfile();
  const updateSocial = useUpdateSocialProfile();
  const toast = useToast();
  if (privacy.isPending || social.isPending) return <Spinner />;
  if (privacy.isError) return <ErrorState error={privacy.error} />;
  const p = privacy.data;
  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(errorMessage(e)) });
  const saveSocial = (patch: Parameters<typeof updateSocial.mutate>[0]) =>
    updateSocial.mutate(patch, {
      onSuccess: () => toast.success("Saved"),
      onError: (e) => toast.error(errorMessage(e)),
    });
  return (
    <>
      <Section title="Profile visibility" description="Choose who can see your profile and activity.">
        <Field label="Who can see your profile">
          <Select
            value={p.profile_visibility}
            onChange={(e) => save({ profile_visibility: e.target.value as typeof p.profile_visibility })}
          >
            <option value="public">Everyone</option>
            <option value="members">Signed-in GistLoop members</option>
            <option value="private">Only me</option>
          </Select>
        </Field>
        <Toggle
          label="Appear in search"
          description="Let people find you by name or username."
          checked={Boolean(p.searchable)}
          onChange={(v) => save({ searchable: v })}
        />
        <Toggle
          label="Show my email on my profile"
          checked={Boolean(p.show_email)}
          onChange={(v) => save({ show_email: v })}
        />
        <Toggle
          label="Show my institutions on my profile"
          checked={Boolean(p.show_affiliations)}
          onChange={(v) => save({ show_affiliations: v })}
        />
      </Section>
      {social.data && (
        <Section title="Followers and mentions">
          <Toggle
            label="Approve new followers"
            description="People must ask before they can follow you."
            checked={Boolean(social.data.requires_follow_approval)}
            onChange={(v) => saveSocial({ requires_follow_approval: v })}
          />
          <Field label="Who can mention you">
            <Select
              value={social.data.allow_mentions_from}
              onChange={(e) =>
                saveSocial({
                  allow_mentions_from: e.target.value as "everyone" | "following" | "nobody",
                })
              }
            >
              <option value="everyone">Everyone</option>
              <option value="following">People I follow</option>
              <option value="nobody">Nobody</option>
            </Select>
          </Field>
        </Section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ notifications
export function NotificationSettings() {
  const settings = useNotificationSettings();
  const categories = useNotificationCategories();
  const update = useUpdateNotificationSettings();
  const toast = useToast();
  if (settings.isPending) return <Spinner />;
  if (settings.isError) return <ErrorState error={settings.error} />;
  const s = settings.data;
  const prefs = (s.categories ?? {}) as Record<string, Record<string, boolean>>;
  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <>
      <Section title="Channels" description="How we reach you.">
        <Toggle
          label="In-app notifications"
          checked={Boolean(s.in_app_enabled)}
          onChange={(v) => save({ in_app_enabled: v })}
        />
        <Toggle label="Email" checked={Boolean(s.email_enabled)} onChange={(v) => save({ email_enabled: v })} />
        <Toggle
          label="Product news and tips by email"
          description="Occasional updates about GistLoop."
          checked={Boolean(s.marketing_emails)}
          onChange={(v) => save({ marketing_emails: v })}
        />
      </Section>
      {categories.data && categories.data.length > 0 && (
        <Section title="What to email me about" description="Security alerts are always sent.">
          {categories.data
            .filter((c) => !c.mandatory)
            .map((c) => (
              <Toggle
                key={c.key}
                label={c.label}
                checked={prefs[c.key]?.email ?? true}
                onChange={(v) => save({ categories: { ...prefs, [c.key]: { ...(prefs[c.key] ?? {}), email: v } } })}
              />
            ))}
        </Section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ security
export function SecuritySettings() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const toast = useToast();
  const active = sessions.data?.filter((s) => !s.revoked_at) ?? [];
  return (
    <Section
      title="Where you're signed in"
      description="Sign out of any device you don't recognise, then change your password."
    >
      {sessions.isPending ? (
        <Spinner />
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} />
      ) : (
        <>
          <ul className={styles.sessions}>
            {active.map((s) => (
              <li key={s.id} className={styles.session}>
                {/mobile|android|iphone/i.test(s.user_agent) ? (
                  <Smartphone size={22} aria-hidden />
                ) : (
                  <Monitor size={22} aria-hidden />
                )}
                <div>
                  <strong>{s.device_name || "Unknown device"}</strong>{" "}
                  {s.current && <Badge tone="success">This device</Badge>}
                  <p className="muted" style={{ fontSize: "var(--text-sm)" }} title={formatDateTime(s.last_seen_at)}>
                    Active {timeAgo(s.last_seen_at)}
                    {s.ip_address ? ` · ${s.ip_address}` : ""}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      revoke.mutate(s.id, {
                        onSuccess: () => toast.success("Signed out of that device"),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {active.length > 1 && (
            <Button
              variant="secondary"
              leading={<LogOut size={16} />}
              loading={revokeOthers.isPending}
              onClick={() =>
                revokeOthers.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success(`Signed out of ${r.revoked} other device${r.revoked === 1 ? "" : "s"}`),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Sign out everywhere else
            </Button>
          )}
        </>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ data
export function DataSettings() {
  const remove = useDeleteAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadMyData();
      toast.success("Your data is downloading");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Section
        title="Download your data"
        description="Get a copy of your profile, posts, communities and settings as a JSON file."
      >
        <Button variant="secondary" leading={<Download size={16} />} loading={exporting} onClick={onExport}>
          Download my data
        </Button>
      </Section>
      <Section
        title="Delete account"
        description="Your account is deactivated immediately and permanently erased after 30 days. You can't undo this."
        danger
      >
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      </Section>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete your account?">
        <div className="stack">
          <p className="muted">
            Your profile, posts and memberships will be removed. Type <strong>DELETE</strong> to confirm.
          </p>
          <Field label="Confirmation">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Your password" hint="To confirm it's really you.">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {remove.isError && <Alert tone="error">{errorMessage(remove.error)}</Alert>}
          <div className="cluster" style={{ justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={typed !== "DELETE" || !password}
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(password, {
                  onSuccess: () => {
                    sessionEnded();
                    navigate("/", { replace: true });
                  },
                })
              }
            >
              Delete forever
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
