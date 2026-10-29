import { Outlet } from "react-router";

import { useAuth } from "@/auth/AuthProvider";
import { GuestOnly, RequireAuth } from "@/auth/guards";
import { AppLayout } from "@/components/layout/AppLayout";
import { MarketingLayout } from "@/components/layout/Layouts";
import { PageLoader } from "@/components/ui/Spinner";

/** Public browse pages: the app shell when signed in, the marketing site otherwise. */
export function AdaptiveLayout() {
  const { status } = useAuth();
  if (status === "loading") return <PageLoader />;
  return status === "signed-in" ? <AppLayout /> : <MarketingLayout />;
}

export function Protected() {
  return (
    <RequireAuth>
      <AppLayout />
    </RequireAuth>
  );
}

export function Guest() {
  return (
    <GuestOnly>
      <Outlet />
    </GuestOnly>
  );
}
