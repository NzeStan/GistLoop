import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, LifeBuoy, Mail, MapPin, Newspaper, Phone, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";

import { ApiError, errorMessage } from "@/api/errors";
import { useContactTopics, useSendContactMessage } from "@/api/queries/site";
import { useAuth } from "@/auth/AuthProvider";
import { PageHero } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Field, Honeypot, Input, Select, Textarea } from "@/components/ui/Form";
import { brand } from "@/config/brand";

import styles from "./Marketing.module.css";

const schema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(120),
  email: z.email("Enter a valid email address"),
  topic: z.string().min(1),
  message: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(5000),
  website: z.string().optional(),
});
type ContactForm = z.infer<typeof schema>;

const FALLBACK_TOPICS = [
  { value: "general", label: "General question" },
  { value: "support", label: "Account and technical support" },
  { value: "safety", label: "Safety or abuse" },
  { value: "partnerships", label: "Partnerships and institutions" },
  { value: "advertising", label: "Advertising and creators" },
  { value: "press", label: "Press and media" },
  { value: "feedback", label: "Feedback and ideas" },
];

export default function ContactPage() {
  const { me } = useAuth();
  const [params] = useSearchParams();
  const topics = useContactTopics();
  const send = useSendContactMessage();
  const options = topics.data ?? FALLBACK_TOPICS;
  const requested = params.get("topic");
  const form = useForm<ContactForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: me?.display_name ?? "",
      email: me?.email ?? "",
      topic: options.some((t) => t.value === requested) ? requested! : "general",
      message: "",
      website: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await send.mutateAsync({ ...values, topic: values.topic as "general", website: values.website ?? "" });
      form.reset({ ...values, message: "" });
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors))
          form.setError(field as keyof ContactForm, { message });
      }
    }
  });

  const { errors, isSubmitting } = form.formState;
  const cards = [
    { icon: Mail, title: "General enquiries", text: brand.contact.email, href: `mailto:${brand.contact.email}` },
    { icon: LifeBuoy, title: "Support", text: brand.contact.support, href: `mailto:${brand.contact.support}` },
    { icon: ShieldAlert, title: "Safety team", text: brand.contact.safety, href: `mailto:${brand.contact.safety}` },
    { icon: Newspaper, title: "Press", text: brand.contact.press, href: `mailto:${brand.contact.press}` },
    {
      icon: Phone,
      title: "Phone",
      text: brand.contact.phone,
      href: `tel:${brand.contact.phone.replace(/\s/g, "")}`,
    },
    { icon: MapPin, title: "Office", text: brand.contact.address },
    { icon: Clock, title: "Hours", text: brand.contact.hours },
  ];

  return (
    <>
      <Seo title="Contact us" description={`Get in touch with the ${brand.name} team.`} />
      <PageHero
        eyebrow="Contact"
        title="We'd love to hear from you"
        description="Questions, feedback, partnerships or a safety concern: send us a message and we'll get back to you within one working day."
      />
      <section className="section">
        <div className={`container ${styles.contactGrid}`}>
          <Card>
            {send.isSuccess ? (
              <div className="stack" role="status">
                <Alert tone="success">
                  <strong>Message sent!</strong> Thanks for reaching out. We'll reply to you by email within one working
                  day. Your reference is <code>{send.data.reference.slice(0, 8).toUpperCase()}</code>.
                </Alert>
                <Button variant="secondary" onClick={() => send.reset()}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form className="stack" onSubmit={onSubmit} noValidate>
                <h2 style={{ fontSize: "var(--text-xl)" }}>Send us a message</h2>
                {send.isError && !(send.error instanceof ApiError && Object.keys(send.error.fieldErrors).length) && (
                  <Alert tone="error">{errorMessage(send.error)}</Alert>
                )}
                <div
                  className="grid-auto"
                  style={{ "--grid-min": "14rem", gap: "var(--space-4)" } as React.CSSProperties}
                >
                  <Field label="Your name" error={errors.name?.message}>
                    <Input autoComplete="name" {...form.register("name")} />
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    <Input type="email" autoComplete="email" {...form.register("email")} />
                  </Field>
                </div>
                <Field label="What's it about?">
                  <Select {...form.register("topic")}>
                    {options.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Message"
                  error={errors.message?.message}
                  hint="Please don't include passwords or card details."
                >
                  <Textarea rows={6} maxLength={5000} {...form.register("message")} />
                </Field>
                <Honeypot {...form.register("website")} />
                <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
                  By sending this message you agree that we'll use your details to reply, as described in our{" "}
                  <Link to="/privacy">privacy policy</Link>.
                </p>
                <div>
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    Send message
                  </Button>
                </div>
              </form>
            )}
          </Card>
          <div className={styles.contactCards}>
            {cards.map(({ icon: Icon, title, text, href }) => (
              <Card key={title} className={styles.contactCard}>
                <span className={styles.featureIcon} style={{ width: "2.5rem", height: "2.5rem" }}>
                  <Icon size={18} aria-hidden />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{href ? <a href={href}>{text}</a> : text}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
