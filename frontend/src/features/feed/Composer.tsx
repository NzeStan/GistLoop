import { ImagePlus, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { errorMessage } from "@/api/errors";
import { useCreatePost, useDeleteMedia, useUploadMedia } from "@/api/queries/social";
import type { PostMedia, SocialVisibility } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Select, Textarea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

import styles from "./Post.module.css";

const MAX = 2000;
const MAX_IMAGES = 4;

interface ComposerProps {
  /** Post into an audience (e.g. a community) instead of choosing a visibility. */
  audience?: { type: "community"; id: string; name: string };
  placeholder?: string;
}

export function Composer({ audience, placeholder = "What's the gist?" }: ComposerProps) {
  const { me } = useAuth();
  const create = useCreatePost();
  const uploadMedia = useUploadMedia();
  const deleteMedia = useDeleteMedia();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<SocialVisibility>("public");
  const [images, setImages] = useState<PostMedia[]>([]);
  const [uploading, setUploading] = useState(0);
  const remaining = MAX - body.length;
  const canPost = (body.trim() || images.length > 0) && remaining >= 0 && uploading === 0;

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
    create.mutate(
      audience ? { body, visibility: audience.type, audience_id: audience.id, media } : { body, visibility, media },
      {
        onSuccess: () => {
          setBody("");
          setImages([]);
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
          {!audience && (
            <>
              <label htmlFor="composer-visibility" className="visually-hidden">
                Who can see this
              </label>
              <Select
                id="composer-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as SocialVisibility)}
              >
                <option value="public">🌍 Everyone</option>
                <option value="followers">👥 Followers</option>
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
