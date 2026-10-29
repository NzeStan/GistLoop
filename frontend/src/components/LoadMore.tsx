import { useInView } from "@/lib/hooks";

import { Button } from "./ui/Button";

/** Loads the next page automatically when scrolled near, with a button as a fallback. */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useInView<HTMLDivElement>(() => {
    if (hasMore && !loading) onLoad();
  }, hasMore);
  if (!hasMore) return null;
  return (
    <div ref={ref} style={{ display: "flex", justifyContent: "center", padding: "var(--space-6) 0" }}>
      <Button variant="secondary" loading={loading} onClick={onLoad}>
        Load more
      </Button>
    </div>
  );
}
