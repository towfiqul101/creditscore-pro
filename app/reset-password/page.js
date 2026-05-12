"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

export default function ResetPasswordPage() {
  var [password, setPassword] = useState("");
  var [confirm, setConfirm] = useState("");
  var [loading, setLoading] = useState(false);
  var [done, setDone] = useState(false);
  var [error, setError] = useState("");
  var [ready, setReady] = useState(false);

  var supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(function () {
    // Supabase puts the token in the URL hash — onAuthStateChange picks it up
    var sub = supabase.auth.onAuthStateChange(function (event, session) {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return function () { sub.data.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    var result = await supabase.auth.updateUser({ password: password });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);

    // Redirect to dashboard after 2 seconds
    setTimeout(function () {
      window.location.href = "/dashboard";
    }, 2000);
  }

  // Success state
  if (done) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "0 20px", background: "var(--bg)",
      }}>
        <div style={{ width: "100%", maxWidth: "360px", textAlign: "center" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            margin: "0 auto 16px", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "28px",
            background: "rgba(57,255,20,0.12)",
          }}>✓</div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px", color: "var(--text)" }}>
            Password updated!
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 20px" }}>
            Redirecting you to the dashboard...
          </p>
          <Link href="/dashboard" style={{
            display: "inline-block", padding: "10px 24px", borderRadius: "10px",
            background: "var(--brand)", color: "#000", textDecoration: "none",
            fontSize: "14px", fontWeight: "700",
          }}>Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Waiting for Supabase to fire PASSWORD_RECOVERY event
  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "0 20px", background: "var(--bg)",
      }}>
        <div style={{ width: "100%", maxWidth: "360px", textAlign: "center" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            border: "3px solid var(--border)", borderTopColor: "var(--brand)",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
            Verifying your reset link...
          </p>
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
            Set new password
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Choose a strong password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={function (e) { setPassword(e.target.value); }}
              placeholder="At least 6 characters"
              required
              minLength={6}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "14px", outline: "none", boxSizing: "border-box",
              }}
              onFocus={function (e) { e.target.style.borderColor = "var(--brand)"; }}
              onBlur={function (e) { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={function (e) { setConfirm(e.target.value); }}
              placeholder="Repeat your password"
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

          {/* Password strength hint */}
          {password.length > 0 && (
            <div style={{
              padding: "8px 12px", borderRadius: "8px",
              background: password.length >= 8 ? "rgba(57,255,20,0.08)" : "rgba(255,165,0,0.08)",
              border: "1px solid " + (password.length >= 8 ? "rgba(57,255,20,0.2)" : "rgba(255,165,0,0.2)"),
            }}>
              <p style={{ fontSize: "12px", margin: 0, color: password.length >= 8 ? "var(--brand)" : "var(--warning)" }}>
                {password.length >= 12 ? "Strong password" : password.length >= 8 ? "Good password" : "Weak — use at least 8 characters"}
              </p>
            </div>
          )}

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
            {loading ? "Updating..." : "Update password →"}
          </button>
        </form>
      </div>
    </div>
  );
}
