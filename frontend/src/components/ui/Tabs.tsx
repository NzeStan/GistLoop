import { type KeyboardEvent, useRef } from "react";

import styles from "./primitives.module.css";

interface TabsProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
}

/** Accessible tabs (arrow keys move between tabs, per the WAI-ARIA pattern). */
export function Tabs<T extends string>({ label, value, onChange, items }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next]!.value);
  };
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(el) => {
            refs.current[index] = el;
          }}
          role="tab"
          type="button"
          className={styles.tab}
          aria-selected={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
