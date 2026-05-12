"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

export default function LoginPage() {
  var [email, setEmail] = useState("");
  var [password, setPassword] = useState("");
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");

  var supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    var result = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    // Hard redirect so browser sends fresh session cookie on next request
    window.location.href = "/dashboard";
  }

  async function handleGoogle() {
    var result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/api/auth/callback" },
    });
    if (result.error) setError(result.error.message);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "0 20px", background: "var(--bg)",
    }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            margin: "0 auto 12px", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "16px", fontWeight: "700",
            background: "rgba(57,255,20,0.12)", color: "var(--brand)",
          }}>CS</div>
          <h1 style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 4px", color: "var(--text)" }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        <button onClick={handleGoogle}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px",
            border: "1.5px solid var(--border)", background: "transparent",
            color: "var(--text)", fontSize: "14px", fontWeight: "500",
            cursor: "pointer", marginBottom: "16px", display: "flex",
            alignItems: "center", justifyContent: "center", gap: "8px",
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>Email</label>
            <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }}
              placeholder="you@email.com" required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "14px", outline: "none", boxSizing: "border-box",
              }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>Password</label>
            <input type="password" value={password} onChange={function(e) { setPassword(e.target.value); }}
              placeholder="Your password" required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "14px", outline: "none", boxSizing: "border-box",
              }} />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px",
              background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)",
              color: "var(--danger)", fontSize: "13px",
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: "10px",
              background: loading ? "var(--border)" : "var(--brand)",
              border: "none", color: loading ? "var(--text-muted)" : "#000",
              fontSize: "14px", fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, marginTop: "4px",
            }}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "12px", marginTop: "20px", color: "var(--text-muted)" }}>
          Don't have an account?{" "}
          <Link href="/signup" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: "600" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
