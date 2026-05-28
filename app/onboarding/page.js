"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function OnboardingPage() {
  var [companyName, setCompanyName] = useState("");
  var [whatsapp, setWhatsapp] = useState("");
  var [loading, setLoading] = useState(false);
  var [pageLoading, setPageLoading] = useState(true);
  var [error, setError] = useState("");
  var [userId, setUserId] = useState(null);

  var supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(function() {
    checkUser();
  }, []);

  async function checkUser() {
    var result = await supabase.auth.getUser();
    var u = result.data && result.data.user;
    if (!u) {
      window.location.href = "/login";
      return;
    }
    setUserId(u.id);

    var profileRes = await supabase
      .from("profiles")
      .select("company_name")
      .eq("id", u.id)
      .single();

    if (profileRes.data && profileRes.data.company_name) {
      window.location.href = "/dashboard";
      return;
    }

    setPageLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setLoading(true);
    setError("");

    var res = await supabase
      .from("profiles")
      .update({ company_name: companyName.trim(), whatsapp: whatsapp.trim() || null })
      .eq("id", userId);

    if (res.error) {
      setError(res.error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  if (pageLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)",
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          border: "3px solid var(--border)", borderTopColor: "var(--brand)",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            One last step
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Tell us about your business so we can set up your account.
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
              Company / Organization Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={function(e) { setCompanyName(e.target.value); }}
              placeholder="Elite Credit Repair LLC"
              required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "14px", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
              WhatsApp Number
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={function(e) { setWhatsapp(e.target.value); }}
              placeholder="+1 (555) 000-0000"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px",
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "14px", outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "5px 0 0" }}>
              Optional — for quick support from our team
            </p>
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px",
              background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)",
              color: "var(--danger)", fontSize: "13px",
            }}>
              {error}
            </div>
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
            {loading ? "Saving..." : "Get started →"}
          </button>
        </form>
      </div>
    </div>
  );
}
