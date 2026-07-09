import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { completeSignupIfPending } from "../lib/completeSignup";
import { Disclaimer } from "../components/Disclaimer";

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      await completeSignupIfPending();
      navigate("/dashboard");
    } else {
      setNeedsConfirmation(true);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="font-display text-xl font-semibold">Check your email</h2>
        <p className="mt-3 text-sm text-ink-muted">
          We've sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it,
          then come back and log in to see your plan.
        </p>
        <Link to="/login" className="mt-6 inline-block text-gold hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h2 className="font-display text-xl font-semibold">Create your account</h2>
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
          minLength={6}
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
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-gold hover:underline">
          Log in
        </Link>
      </p>
      <Disclaimer className="mt-8" />
    </div>
  );
}
