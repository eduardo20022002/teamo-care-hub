import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSession, onAuthStateChange } from "@/services/auth.service";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

// Dev-only bypass: set VITE_DEV_BYPASS_AUTH=true in .env.local to skip Supabase auth.
// .env.local is gitignored — this never ships to production.
// ATENÇÃO: NUNCA ativar VITE_DEV_BYPASS_AUTH=true em máquinas que apontam para o banco
// de staging, pois o mock user (000...001) pode ter acesso a dados reais de staging.
const DEV_MOCK_USER =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true"
    ? ({
        id: "00000000-0000-0000-0000-000000000001",
        email: "preview@teamo.dev",
        user_metadata: { display_name: "Eduardo" },
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as unknown as User)
    : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!DEV_MOCK_USER);

  useEffect(() => {
    if (DEV_MOCK_USER) return;
    const sub = onAuthStateChange((s) => {
      setSession(s);
      setLoading(false);
    });
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    return () => sub.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: DEV_MOCK_USER ?? session?.user ?? null,
      loading,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
