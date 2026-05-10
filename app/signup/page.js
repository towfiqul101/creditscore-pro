"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) { setError(error.message); setLoading(false); }
    else setSuccess(true);
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) setError(error.message);
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--bg)" }}>
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl"
          style={{ background: "rgba(57,255,20,0.12)" }}>✓</div>
        <h2 className="text-lg font-semibold mb-2">Check your email</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
        <Link href="/login" className="text-sm" style={{ color: "var(--brand)" }}>Back to sign in</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-lg font-bold"
            style={{ background: "rgba(57,255,20,0.12)", color: "var(--brand)" }}>CS</div>
          <h1 className="text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Start analyzing credit profiles today</p>
        </div>

        <button onClick={handleGoogle}
          className="w-full py-3 rounded-xl text-sm font-medium mb-4 flex items-center justify-center gap-2 transition-all hover:opacity-90"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        <form onSubmit={handleSignup}>
          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Full name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
              className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)" }}
              placeholder="John Doe" />
          </div>
          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)" }}
              placeholder="you@email.com" />
          </div>
          <div className="mb-5">
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)" }}
              placeholder="Min 6 characters" />
          </div>

          {error && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--brand)", color: "#000", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          Already have an account? <Link href="/login" style={{ color: "var(--brand)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
