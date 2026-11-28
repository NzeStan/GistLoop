import { BarChart3, ImagePlus, MapPin, MessageSquareOff, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { errorMessage } from "@/api/errors";
import { useMyMemberships } from "@/api/queries/institutions";
import { useCreatePost, useDeleteMedia, useUploadMedia } from "@/api/queries/social";
import type { PostMedia, SocialVisibility } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Input, Select, Textarea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

import styles from "./Post.module.css";

const MAX = 2000;
const MAX_IMAGES = 4;

interface ComposerProps {
  /** Post into an audience (a community, school or campus) instead of choosing a visibility. */
  audience?: { type: "community" | "institution" | "campus"; id: string; name: string };
  placeholder?: string;
}

export function Composer({ audience, placeholder = "What's the gist?" }: ComposerProps) {
  const { me } = useAuth();
  const create = useCreatePost();
  const uploadMedia = useUploadMedia();
  const deleteMedia = useDeleteMedia();
  const toast = useToast();
  const [body, setBody] = useState("");
  // "public" | "followers" | "private", or "institution:<id>" / "campus:<id>" for your schools.
  const [visibility, setVisibility] = useState<string>("public");
  const memberships = useMyMemberships(!audience);
  const schoolOptions = (memberships.data ?? [])
    .filter((m) => m.status === "verified")
    .flatMap((m) => [
      { value: `institution:${m.institution.id}`, label: `🎓 ${m.institution.short_name || m.institution.name} only` },
      ...(m.campus
        ? [{ value: `campus:${m.campus}`, label: `🏫 My campus at ${m.institution.short_name || m.institution.name}` }]
        : []),
    ]);
  const [images, setImages] = useState<PostMedia[]>([]);
  const [place, setPlace] = useState<string | null>(null);
  const [poll, setPoll] = useState<{ options: string[]; multiple: boolean; days: number } | null>(null);
  const [noComments, setNoComments] = useState(false);
  const pollOptions = poll?.options.map((o) => o.trim()).filter(Boolean) ?? [];
  const [uploading, setUploading] = useState(0);
  const remaining = MAX - body.length;
  const canPost =
    (body.trim() || images.length > 0) && remaining >= 0 && uploading === 0 && (!poll || pollOptions.length >= 2);

  const onPick = async (files: File[]) => {
    const room = MAX_IMAGES - images.length;
    if (files.length > room) toast.error(`You can add up to ${MAX_IMAGES} images.`);
    const batch = files.slice(0, Math.max(room, 0));
    setUploading((n) => n + batch.length);
    await Promise.all(
      batch.map(async (file) => {
        try {
          const media = await uploadMedia.mutateAsync(file);
          setImages((current) => [...current, media]);
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  };

  const onRemove = (media: PostMedia) => {
    setImages((current) => current.filter((m) => m.id !== media.id));
    deleteMedia.mutate(media.id); // Unattached uploads are cleaned up by the API anyway.
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canPost) return;
    const media = images.map((m) => m.id);
    const extras = {
      ...(place?.trim() ? { location: place.trim() } : {}),
      ...(poll
        ? { poll: { options: pollOptions, allows_multiple: poll.multiple, duration_hours: poll.days * 24 } }
        : {}),
      ...(noComments ? { comments_enabled: false } : {}),
    };
    const [scope, scopeId] = visibility.split(":");
    create.mutate(
      audience
        ? { body, visibility: audience.type, audience_id: audience.id, media, ...extras }
        : scopeId
          ? { body, visibility: scope as SocialVisibility, audience_id: scopeId, media, ...extras }
          : { body, visibility: visibility as SocialVisibility, media, ...extras },
      {
        onSuccess: () => {
          setBody("");
          setImages([]);
          setPlace(null);
          setPoll(null);
          setNoComments(false);
          toast.success("Posted!");
        },
      },
    );
  };

  return (
    <form className={styles.composer} onSubmit={onSubmit} aria-label="Create a post">
      <Avatar name={me?.display_name} seed={me?.id} src={me?.avatar_url} />
      <div className={styles.content}>
        <label htmlFor="composer" className="visually-hidden">
          Write a post
        </label>
        <Textarea
          id="composer"
          placeholder={audience ? `Share something with ${audience.name}…` : placeholder}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
        />
        {(images.length > 0 || uploading > 0) && (
          <ul className={styles.attachments} aria-label="Attached images">
            {images.map((m) => (
              <li key={m.id}>
                <img src={m.url} alt={m.alt_text} />
                <button type="button" onClick={() => onRemove(m)} aria-label="Remove image">
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <li key={`uploading-${i}`} className={styles.attachmentLoading} aria-label="Uploading image" />
            ))}
          </ul>
        )}
        {poll && (
          <fieldset
            className="stack"
            style={{ border: 0, padding: 0, "--stack-gap": "var(--space-2)" } as React.CSSProperties}
          >
            <legend style={{ fontWeight: 650, fontSize: "var(--text-sm)" }}>Poll</legend>
            {poll.options.map((option, i) => (
              <Input
                key={i}
                aria-label={`Option ${i + 1}`}
                placeholder={`Option ${i + 1}`}
                maxLength={80}
                value={option}
                onChange={(e) =>
                  setPoll((p) => p && { ...p, options: p.options.map((o, j) => (j === i ? e.target.value : o)) })
                }
              />
            ))}
            <div className="cluster">
              {poll.options.length < 4 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPoll((p) => p && { ...p, options: [...p.options, ""] })}
                >
                  Add option
                </Button>
              )}
              <Checkbox
                label="Allow several answers"
                checked={poll.multiple}
                onChange={(e) => setPoll((p) => p && { ...p, multiple: e.target.checked })}
              />
              <Select
                aria-label="Poll length"
                value={poll.days}
                onChange={(e) => setPoll((p) => p && { ...p, days: Number(e.target.value) })}
              >
                {[1, 3, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "1 day" : `${d} days`}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPoll(null)}>
                Remove poll
              </Button>
            </div>
          </fieldset>
        )}
        {place !== null && (
          <Input
            aria-label="Place"
            placeholder="Where are you? e.g. UNILAG main library"
            maxLength={100}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        )}
        {create.isError && <Alert tone="error">{errorMessage(create.error)}</Alert>}
        <div className={styles.composerFoot}>
          <FilePicker
            multiple
            maxMb={10}
            variant="ghost"
            size="sm"
            label="Add images"
            leading={<ImagePlus size={18} />}
            disabled={images.length + uploading >= MAX_IMAGES}
            onPick={(files) => void onPick(files)}
          >
            <span className="visually-hidden">Add images</span>
          </FilePicker>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon
            aria-label="Add a poll"
            aria-pressed={Boolean(poll)}
            onClick={() => setPoll((p) => (p ? null : { options: ["", ""], multiple: false, days: 1 }))}
          >
            <BarChart3 size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon
            aria-label="Add a place"
            aria-pressed={place !== null}
            onClick={() => setPlace((p) => (p === null ? "" : null))}
          >
            <MapPin size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon
            aria-label={noComments ? "Allow comments" : "Turn off comments"}
            aria-pressed={noComments}
            onClick={() => setNoComments((v) => !v)}
          >
            <MessageSquareOff size={18} />
          </Button>
          {!audience && (
            <>
              <label htmlFor="composer-visibility" className="visually-hidden">
                Who can see this
              </label>
              <Select
                id="composer-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="public">🌍 Everyone (all schools)</option>
                <option value="followers">👥 Followers</option>
                {schoolOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="private">🔒 Only me</option>
              </Select>
            </>
          )}
          <span className={cn(styles.counter, remaining < 0 && styles.counterOver)} aria-live="polite">
            {remaining < 100 ? `${remaining} characters left` : ""}
          </span>
          <Button type="submit" loading={create.isPending} disabled={!canPost}>
            Post
          </Button>
        </div>
      </div>
    </form>
  );
}
