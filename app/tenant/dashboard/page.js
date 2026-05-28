"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function TenantDashboardPage() {
  var [user, setUser] = useState(null);
  var [tenant, setTenant] = useState(null);
  var [analyses, setAnalyses] = useState([]);
  var [thisMonthCount, setThisMonthCount] = useState(0);
  var [loading, setLoading] = useState(true);
  var [search, setSearch] = useState("");

  var supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(function() { loadData(); }, []);

  async function loadData() {
    var authRes = await supabase.auth.getUser();
    var u = authRes.data && authRes.data.user;
    if (!u) { window.location.href = "/login"; return; }
    setUser(u);

    var memberRes = await supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants(*)")
      .eq("user_id", u.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!memberRes.data || !memberRes.data.tenants) {
      window.location.href = "/dashboard";
      return;
    }

    var t = memberRes.data.tenants;
    setTenant(t);

    var analysesRes = await supabase
      .from("analyses")
      .select("id, contact_first_name, contact_last_name, contact_email, contact_phone, funding_score, funding_percentage, estimated_funding, score_avg, ghl_synced, created_at")
      .eq("tenant_id", t.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setAnalyses(analysesRes.data || []);

    var firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    var countRes = await supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t.id)
      .gte("created_at", firstOfMonth);
    setThisMonthCount(countRes.count || 0);

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  var totalClients = (function() {
    var seen = {};
    var count = 0;
    analyses.forEach(function(a) {
      if (a.contact_email && !seen[a.contact_email]) { seen[a.contact_email] = true; count++; }
    });
    return count;
  })();
  var ghlSynced = analyses.filter(function(a) { return a.ghl_synced; }).length;
  var fundingReady = analyses.filter(function(a) { return (a.funding_score || 0) >= 8; }).length;
  var analysisLimit = tenant.analysis_limit || 300;
  var usagePct = Math.min((thisMonthCount / analysisLimit) * 100, 100);
  var usageColor = thisMonthCount >= 270 ? "var(--danger)" : thisMonthCount >= 240 ? "var(--warning)" : "var(--brand)";
  var firstName = user && user.user_metadata && user.user_metadata.full_name
    ? user.user_metadata.full_name.split(" ")[0] : "there";
  var monthYear = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  var filtered = analyses.filter(function(a) {
    if (!search) return true;
    var q = search.toLowerCase();
    var name = ((a.contact_first_name || "") + " " + (a.contact_last_name || "")).toLowerCase();
    return name.includes(q) || (a.contact_email || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: "56px",
        background: "var(--bg)", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} style={{ height: "36px", borderRadius: "8px", objectFit: "contain" }} />
          ) : (
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(57,255,20,0.12)", color: "var(--brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: "700",
            }}>CS</div>
          )}
          <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text)" }}>
            {tenant.brand_name || tenant.name}
          </span>
          <span style={{
            fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
            background: "var(--surface)", color: "var(--text-muted)", fontWeight: "500",
          }}>Business Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a href="/analysis/new" style={{
            padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "700",
            background: "var(--brand)", color: "#000", textDecoration: "none",
          }}>+ New Analysis</a>
          <a href="/tenant/settings" style={{
            padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "500",
            background: "transparent", color: "var(--text-muted)", textDecoration: "none",
            border: "1px solid var(--border)",
          }}>Settings</a>
          <button onClick={handleLogout} style={{
            background: "none", border: "none", fontSize: "13px",
            color: "var(--text-muted)", cursor: "pointer", padding: "0",
          }}>Sign out</button>
        </div>
      </header>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Welcome */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>
            {"Welcome back, " + firstName}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {tenant.name + " · " + monthYear}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "Total Clients", value: totalClients, color: "var(--text)" },
            { label: "This Month", value: thisMonthCount, color: "var(--text)" },
            { label: "GHL Synced", value: ghlSynced, color: ghlSynced > 0 ? "var(--brand)" : "var(--text)" },
            { label: "Funding Ready", value: fundingReady, color: fundingReady > 0 ? "var(--brand)" : "var(--text)" },
          ].map(function(s) {
            return (
              <div key={s.label} style={{
                padding: "18px", borderRadius: "12px",
                background: "var(--bg-card)", border: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 4px", color: s.color }}>{s.value}</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Monthly usage */}
        <div style={{
          padding: "16px 20px", borderRadius: "12px", marginBottom: "12px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Monthly Usage</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {thisMonthCount + " / " + analysisLimit + " analyses used this month"}
            </span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: usagePct + "%", borderRadius: "3px", background: usageColor, transition: "width 0.4s" }} />
          </div>
          {thisMonthCount > 250 && (
            <p style={{ fontSize: "11px", color: "var(--warning)", margin: "8px 0 0" }}>
              {"⚠ Approaching monthly limit — " + (analysisLimit - thisMonthCount) + " analyses remaining"}
            </p>
          )}
        </div>

        {/* GHL banner */}
        <div style={{
          padding: "12px 16px", borderRadius: "10px", marginBottom: "24px",
          background: tenant.ghl_enabled ? "rgba(57,255,20,0.07)" : "rgba(255,165,0,0.07)",
          border: "1px solid " + (tenant.ghl_enabled ? "rgba(57,255,20,0.25)" : "rgba(255,165,0,0.25)"),
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "13px", color: tenant.ghl_enabled ? "var(--brand)" : "#FFA500", fontWeight: "500" }}>
            {tenant.ghl_enabled
              ? "✓ GHL Connected — analyses sync to your CRM automatically"
              : "⚠ GHL Not Connected — Set up in Settings to enable CRM sync"}
          </span>
          {!tenant.ghl_enabled && (
            <a href="/tenant/settings#ghl" style={{ fontSize: "12px", fontWeight: "700", color: "#FFA500", textDecoration: "none" }}>
              → Go to Settings
            </a>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            placeholder="Search clients by name or email..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: "10px",
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              color: "var(--text)", fontSize: "13px", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Table */}
        <div style={{ borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 0.8fr 0.8fr 1.2fr 0.8fr 1fr 0.7fr",
            gap: "8px", padding: "10px 16px",
            background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
          }}>
            {["Client", "Email", "Score", "FICO", "Funding", "GHL", "Date", ""].map(function(h) {
              return (
                <span key={h} style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {h}
                </span>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", background: "var(--bg-card)" }}>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: "0 0 8px" }}>
                {search ? "No clients match your search." : "No analyses yet."}
              </p>
              {!search && (
                <a href="/analysis/new" style={{ fontSize: "13px", color: "var(--brand)", textDecoration: "none" }}>
                  Click + New Analysis to get started →
                </a>
              )}
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)" }}>
              {filtered.map(function(a) {
                var name = ((a.contact_first_name || "") + " " + (a.contact_last_name || "")).trim() || "Unknown";
                var score = a.funding_score || 0;
                var scoreColor = score >= 8 ? "var(--brand)" : score >= 5 ? "var(--warning)" : "var(--danger)";
                var date = new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                return (
                  <div key={a.id} style={{
                    display: "grid", gridTemplateColumns: "2fr 2fr 0.8fr 0.8fr 1.2fr 0.8fr 1fr 0.7fr",
                    gap: "8px", padding: "12px 16px", alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.contact_email || "—"}</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: scoreColor }}>{score + "/10"}</span>
                    <span style={{ fontSize: "12px", color: "var(--text)" }}>{a.score_avg || "—"}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{a.estimated_funding || "—"}</span>
                    <span style={{
                      display: "inline-block", padding: "3px 8px", borderRadius: "6px",
                      fontSize: "11px", fontWeight: "600",
                      background: a.ghl_synced ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.06)",
                      color: a.ghl_synced ? "var(--brand)" : "var(--text-dim)",
                    }}>{a.ghl_synced ? "Synced" : "Pending"}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{date}</span>
                    <a href={"/analysis/" + a.id} style={{
                      display: "inline-block", padding: "5px 10px", borderRadius: "6px",
                      fontSize: "11px", fontWeight: "600", textDecoration: "none",
                      background: "rgba(57,255,20,0.1)", color: "var(--brand)",
                      border: "1px solid rgba(57,255,20,0.2)",
                    }}>View</a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
