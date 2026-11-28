import { useState } from "react";

import { type AnalyticsReport as Report, type Range, useScopeAnalytics } from "@/api/queries/analytics";
import m from "@/components/Manage.module.css";
import { Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { formatCount, formatDate, humanize } from "@/lib/format";

/** "social.post.created" → "Social post created". */
const label = (metric: string) => humanize(metric.replace(/[._]/g, " "));

function Bars({ series }: { series: { date: string; value: number | null }[] }) {
  const max = Math.max(1, ...series.map((p) => p.value ?? 0));
  return (
    <svg viewBox={`0 0 ${series.length * 6} 24`} width="100%" height="24" preserveAspectRatio="none" aria-hidden>
      {series.map((p, i) => {
        const h = ((p.value ?? 0) / max) * 22;
        return (
          <rect
            key={p.date}
            x={i * 6}
            y={24 - h}
            width={4}
            height={Math.max(h, 0.5)}
            fill="var(--color-primary)"
            rx={1}
          />
        );
      })}
    </svg>
  );
}

/** Totals with a small daily bar chart for each metric. */
export function AnalyticsReportView({
  query,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: Report | undefined };
}) {
  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={query.error} />;
  const report = query.data!;
  if (report.metrics.length === 0) return <p className="muted">No activity in this period yet.</p>;
  return (
    <div className="stack">
      <p className={m.small}>
        {formatDate(report.from)} – {formatDate(report.to)}
        {report.suppression_threshold
          ? ` · numbers under ${report.suppression_threshold} are hidden to protect people's privacy`
          : ""}
      </p>
      <div className={m.statGrid}>
        {report.metrics.map((metric) => (
          <div key={metric.metric} className={m.stat}>
            <span className={m.statValue}>
              {metric.total == null ? "<" + (report.suppression_threshold ?? "") : formatCount(metric.total)}
            </span>
            <span className={m.small}>{label(metric.metric)}</span>
            <Bars series={metric.series} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A community's or school's numbers, for its admins (needs analytics.view there). */
export function ScopeStats({ scopeType, scopeId }: { scopeType: string; scopeId: string }) {
  const [range, setRange] = useState<Range>({});
  const report = useScopeAnalytics(scopeType, scopeId, range);
  return (
    <div className="stack">
      <RangePicker value={range} onChange={setRange} />
      <AnalyticsReportView query={report} />
    </div>
  );
}

/** From/to date inputs (empty: the last 30 days). */
export function RangePicker({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <div className="cluster">
      <Field label="From" optional>
        <Input
          type="date"
          value={value.from ?? ""}
          onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        />
      </Field>
      <Field label="To" optional>
        <Input
          type="date"
          value={value.to ?? ""}
          onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}
