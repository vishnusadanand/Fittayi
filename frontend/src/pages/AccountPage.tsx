import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

export function AccountPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/login");
  }, [authLoading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h2 className="font-display text-xl font-semibold">Account</h2>
      <p className="mt-1 text-sm text-ink-muted">Signed in as {user?.email}</p>

      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-muted">Change password</h3>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
        <input
          type="password"
          required
          minLength={6}
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-muted"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-muted"
        />
        {error && <p className="text-sm text-terracotta">{error}</p>}
        {success && (
          <div className="rounded-lg border border-cardamom bg-cardamom/10 px-4 py-3 text-sm text-ink">
            Password updated.
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gold px-6 py-2 font-medium text-backwater hover:brightness-90 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
