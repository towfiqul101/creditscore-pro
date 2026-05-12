"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

export default function ForgotPasswordPage() {
  var [email, setEmail] = useState("");
  var [loading, setLoading] = useState(false);
  var [sent, setSent] = useState(false);
  var [error, setError] = useState("");

  var supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    var result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "0 20px", background: "var(--bg)",
      }}>
        <div style={{ width: "100%", maxWidth: "360px", textAlign: "center" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            margin: "0 auto 16px", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "24px",
            background: "rgba(57,255,20,0.12)",
          }}>✉️</div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px", color: "var(--text)" }}>
            Check your inbox
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 24px", lineHeight: "1.6" }}>
            We sent a password reset link to <strong style={{ color: "var(--text)" }}>{email}</strong>.
            Click the link in the email to set a new password.
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: "0 0 20px" }}>
            Didn't get it? Check your spam folder or try again.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={function () { setSent(false); }}
              style={{
                padding: "10px 20px", borderRadius: "10px", fontSize: "13px",
                fontWeight: "600", cursor: "pointer",
                background: "transparent", border: "1.5px solid var(--border)", color: "var(--text-muted)",
              }}>Try again</button>
            <Link href="/login" style={{
              padding: "10px 20px", borderRadius: "10px", fontSize: "13px",
              fontWeight: "700", textDecoration: "none",
              background: "var(--brand)", color: "#000",
            }}>Back to login</Link>
          </div>
        </div>
      </div>
    );
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
            Reset your password
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={function (e) { setEmail(e.target.value); }}
              placeholder="you@email.com"
              required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "14px", outline: "none", boxSizing: "border-box",
              }}
              onFocus={function (e) { e.target.style.borderColor = "var(--brand)"; }}
              onBlur={function (e) { e.target.style.borderColor = "var(--border)"; }}
            />
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
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? "Sending..." : "Send reset link →"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "12px", marginTop: "20px", color: "var(--text-muted)" }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: "600" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
