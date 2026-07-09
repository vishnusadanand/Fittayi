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
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          FITTAYI
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <button onClick={handleSignOut} className="text-neutral-500 hover:underline">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:underline">
                Log in
              </Link>
              <Link
                to="/quiz"
                className="rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
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
