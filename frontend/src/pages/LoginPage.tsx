import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { completeSignupIfPending } from "../lib/completeSignup";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    await completeSignupIfPending();
    navigate("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h2 className="font-display text-xl font-semibold">Log in</h2>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-muted"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-muted"
        />
        {error && <p className="text-sm text-terracotta">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gold px-6 py-2 font-medium text-backwater hover:brightness-90 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        No account yet?{" "}
        <Link to="/signup" className="text-gold hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
