import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <header className="border-b border-line bg-backwater">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="font-display text-lg font-bold tracking-tight text-gold">
          FITTAYI
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/dashboard" className="text-ink hover:underline">
                Dashboard
              </Link>
              <Link to="/log-meal" className="text-ink hover:underline">
                Log a meal
              </Link>
              <Link to="/workout" className="text-ink hover:underline">
                Workout
              </Link>
              <Link to="/account" className="text-ink-muted hover:underline">
                Account
              </Link>
              <button onClick={handleSignOut} className="text-ink-muted hover:underline">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-ink hover:underline">
                Log in
              </Link>
              <Link
                to="/quiz"
                className="rounded-full bg-gold px-4 py-2 font-medium text-backwater hover:brightness-90"
              >
                Build My Meal Plan
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
