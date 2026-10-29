import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import * as session from "@/api/auth";
import { useMe } from "@/api/queries/account";
import type { Me } from "@/api/types";

type Status = "loading" | "signed-in" | "signed-out";

interface AuthContextValue {
  status: Status;
  me: Me | undefined;
  signIn: typeof session.signIn;
  completeMfa: typeof session.completeMfa;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [restored, setRestored] = useState(false);
  const signedIn = useSyncExternalStore(session.subscribe, session.isSignedIn, () => false);
  const me = useMe(signedIn);

  useEffect(() => {
    let active = true;
    void session.restoreSession().finally(() => active && setRestored(true));
    return () => {
      active = false;
    };
  }, []);

  // Signed out (here, in another tab, or by the server): drop every cached response, since much of
  // it was personalised for the previous user.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (wasSignedIn.current && !signedIn) queryClient.clear();
    wasSignedIn.current = signedIn;
  }, [signedIn, queryClient]);

  const signOut = useCallback(async () => {
    await session.signOut();
    queryClient.clear();
  }, [queryClient]);

  const status: Status = !restored || (signedIn && me.isPending) ? "loading" : signedIn ? "signed-in" : "signed-out";

  const value = useMemo<AuthContextValue>(
    () => ({ status, me: me.data, signIn: session.signIn, completeMfa: session.completeMfa, signOut }),
    [status, me.data, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
