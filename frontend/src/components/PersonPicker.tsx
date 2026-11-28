import { useState } from "react";

import { usePeopleSearch } from "@/api/queries/discovery";
import m from "@/components/Manage.module.css";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { useDebounced } from "@/lib/hooks";

export interface PickedPerson {
  id: string;
  display_name: string;
  handle?: string | null;
}

/** Search people by name or username and pick one. */
export function PersonPicker({
  label,
  action = "Choose",
  onPick,
}: {
  label: string;
  action?: string;
  onPick: (person: PickedPerson) => void;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q).trim().replace(/^@/, "");
  const people = usePeopleSearch(query);
  return (
    <div className="stack" style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
      <Field label={label}>
        <Input
          type="search"
          placeholder="Search by name or username"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Field>
      {query.length >= 3 && (
        <ul className={m.list}>
          {(people.data ?? []).slice(0, 6).map((p) => (
            <li key={p.id} className={m.item}>
              <span className="cluster">
                <Avatar name={p.display_name} seed={p.id} src={p.avatar_url} size="sm" />
                {p.display_name} {p.handle && <span className={m.small}>@{p.handle}</span>}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  onPick(p);
                  setQ("");
                }}
              >
                {action}
              </Button>
            </li>
          ))}
          {people.data?.length === 0 && <li className="muted">Nobody found.</li>}
        </ul>
      )}
    </div>
  );
}
