import { type FormEvent, useRef, useState } from "react";

import { errorMessage } from "@/api/errors";
import { useSubscribeNewsletter } from "@/api/queries/site";
import { Button } from "@/components/ui/Button";
import { Honeypot, Input } from "@/components/ui/Form";

import styles from "./SiteFooter.module.css";

export function NewsletterForm() {
  const subscribe = useSubscribeNewsletter();
  const [email, setEmail] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    subscribe.mutate({ email, website: honeypot.current?.value ?? "" }, { onSuccess: () => setEmail("") });
  };

  if (subscribe.isSuccess) {
    return (
      <p className={styles.newsletterDone} role="status">
        Almost there! Check your inbox to confirm your subscription.
      </p>
    );
  }

  return (
    <form className={styles.newsletter} onSubmit={onSubmit} noValidate={false}>
      <label htmlFor="newsletter-email" className="visually-hidden">
        Email address
      </label>
      <Input
        id="newsletter-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Honeypot ref={honeypot} name="website" />
      <Button type="submit" loading={subscribe.isPending}>
        Subscribe
      </Button>
      {subscribe.isError && (
        <p className={styles.newsletterError} role="alert">
          {errorMessage(subscribe.error)}
        </p>
      )}
    </form>
  );
}
