import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

// Frontend convenience only — real enforcement is Postgres RLS on
// user_profiles.is_admin (PRD Section 6.7). This just avoids flashing admin
// UI at a non-admin before their own queries fail.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Reset to "loading" on every user change, not just to/from null — a
    // direct admin-account -> different-non-admin-account transition (e.g.
    // a multi-tab session swap) would otherwise briefly keep the PREVIOUS
    // user's isAdmin=true while this effect's query for the new user is
    // still in flight, letting admin UI flash for a non-admin.
    setIsAdmin(null);
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data?.is_admin));
  }, [user]);

  if (authLoading || isAdmin === null) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>;
  }
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
