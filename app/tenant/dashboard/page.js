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
  var [copiedId, setCopiedId] = useState(null);
  var [sendModal, setSendModal] = useState({
    open: false, analysis: null,
    sendSms: true, sendEmail: true, sending: false, result: null
  });
  var [activeFilter, setActiveFilter] = useState("all");

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
      .select("id, contact_first_name, contact_last_name, contact_email, contact_phone, funding_score, funding_percentage, estimated_funding, score_avg, ghl_synced, ghl_contact_id, created_at")
      .eq("tenant_id", t.id)
      .order("created_at", { ascending: false })
      .limit(100);
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

  function handleCopyRowLink(id) {
    var url = window.location.origin + "/results/" + id;
    navigator.clipboard.writeText(url).then(function() {
      setCopiedId(id);
      setTimeout(function() { setCopiedId(null); }, 2000);
    });
  }

  function openSendModal(a) {
    setSendModal({ open: true, analysis: a, sendSms: true, sendEmail: true, sending: false, result: null });
  }

  function closeSendModal() {
    setSendModal({ open: false, analysis: null, sendSms: true, sendEmail: true, sending: false, result: null });
  }

  async function handleSendNow() {
    var modal = sendModal;
    setSendModal(function(prev) { return Object.assign({}, prev, { sending: true, result: null }); });
    try {
      var res = await fetch("/api/tenant/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: modal.analysis.id, sendSms: modal.sendSms, sendEmail: modal.sendEmail }),
      });
      var data = await res.json();
      setSendModal(function(prev) { return Object.assign({}, prev, { sending: false, result: data }); });
    } catch (err) {
      setSendModal(function(prev) { return Object.assign({}, prev, { sending: false, result: { success: false, error: err.message } }); });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            border: "3px solid rgba(57,255,20,0.2)", borderTopColor: "var(--brand)",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Stats ─────────────────────────────────────────
  var totalClients = (function() {
    var seen = {};
    analyses.forEach(function(a) { if (a.contact_email) seen[a.contact_email] = true; });
    return Object.keys(seen).length;
  })();
  var ghlSynced = analyses.filter(function(a) { return a.ghl_synced; }).length;
  var fundingReady = analyses.filter(function(a) { return (a.funding_score || 0) >= 8; }).length;
  var avgScore = analyses.length > 0
    ? Math.round(analyses.reduce(function(s, a) { return s + (a.funding_score || 0); }, 0) / analyses.length * 10) / 10
    : 0;
  var analysisLimit = (tenant && tenant.analysis_limit) || 300;
  var usagePct = Math.min((thisMonthCount / analysisLimit) * 100, 100);
  var firstName = user && user.user_metadata && user.user_metadata.full_name
    ? user.user_metadata.full_name.split(" ")[0] : "there";
  var brandColor = (tenant && tenant.brand_color) ? tenant.brand_color : "#39FF14";

  // ── Filtering ─────────────────────────────────────
  var filtered = analyses.filter(function(a) {
    var matchSearch = true;
    var matchFilter = true;
    if (search) {
      var q = search.toLowerCase();
      var name = ((a.contact_first_name || "") + " " + (a.contact_last_name || "")).toLowerCase();
      matchSearch = name.includes(q) || (a.contact_email || "").toLowerCase().includes(q);
    }
    if (activeFilter === "ready") matchFilter = (a.funding_score || 0) >= 8;
    if (activeFilter === "synced") matchFilter = !!a.ghl_synced;
    if (activeFilter === "needs_work") matchFilter = (a.funding_score || 0) < 5;
    return matchSearch && matchFilter;
  });

  function scoreColor(score) {
    if (score >= 8) return "var(--brand)";
    if (score >= 5) return "var(--warning)";
    return "var(--danger)";
  }

  function scoreBg(score) {
    if (score >= 8) return "rgba(57,255,20,0.1)";
    if (score >= 5) return "rgba(255,184,0,0.1)";
    return "rgba(255,68,68,0.1)";
  }

  function initials(a) {
    var f = (a.contact_first_name || "?")[0].toUpperCase();
    var l = (a.contact_last_name || "")[0] ? a.contact_last_name[0].toUpperCase() : "";
    return f + l;
  }

  function avatarColor(name) {
    var colors = [
      "rgba(57,255,20,0.15)", "rgba(99,149,255,0.15)",
      "rgba(255,99,160,0.15)", "rgba(255,184,0,0.15)",
      "rgba(0,210,210,0.15)",
    ];
    var idx = (name || "").charCodeAt(0) % colors.length;
    return colors[idx];
  }

  function avatarTextColor(name) {
    var colors = ["var(--brand)", "#6395ff", "#ff63a0", "var(--warning)", "#00d2d2"];
    var idx = (name || "").charCodeAt(0) % colors.length;
    return colors[idx];
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .client-row { transition: background 0.15s; }
        .client-row:hover { background: rgba(255,255,255,0.03) !important; }
        .action-btn { transition: all 0.15s; }
        .action-btn:hover { opacity: 0.85; transform: scale(0.97); }
        .filter-pill { transition: all 0.15s; }
        .filter-pill:hover { border-color: rgba(57,255,20,0.4) !important; color: var(--brand) !important; }
        .stat-card { transition: transform 0.15s, border-color 0.15s; }
        .stat-card:hover { transform: translateY(-2px); border-color: rgba(57,255,20,0.2) !important; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: "60px",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name}
              style={{ height: "34px", borderRadius: "8px", objectFit: "contain" }} />
          ) : (
            <div style={{
              width: "34px", height: "34px", borderRadius: "10px",
              background: brandColor + "22", color: brandColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: "700",
            }}>CS</div>
          )}
          <div>
            <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)", margin: 0, lineHeight: 1.2 }}>
              {tenant.brand_name || tenant.name}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: 1.2 }}>
              Business Dashboard
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <a href="/analysis/new" style={{
            padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "700",
            background: "var(--brand)", color: "#000", textDecoration: "none",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> New Analysis
          </a>
          <a href="/tenant/settings" style={{
            padding: "8px 14px", borderRadius: "8px", fontSize: "13px",
            border: "1px solid var(--border)", color: "var(--text-muted)",
            textDecoration: "none", transition: "all 0.15s",
          }}>Settings</a>
          <button onClick={handleLogout} style={{
            padding: "8px 14px", borderRadius: "8px", fontSize: "13px",
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
          }}>Sign out</button>
        </div>
      </header>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>

        {/* ── WELCOME ── */}
        <div style={{ marginBottom: "28px", animation: "fadeIn 0.4s ease" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text)", margin: "0 0 4px" }}>
            {"Good " + (new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening") + ", " + firstName} 👋
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            {" · "}{tenant.name}
          </p>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: "Total Clients", value: totalClients, icon: "👥", color: "var(--text)" },
            { label: "This Month", value: thisMonthCount, icon: "📅", color: "var(--text)" },
            { label: "Funding Ready", value: fundingReady, icon: "✅", color: "var(--brand)" },
            { label: "Avg Score", value: avgScore + "/10", icon: "⭐", color: avgScore >= 7 ? "var(--brand)" : avgScore >= 5 ? "var(--warning)" : "var(--danger)" },
          ].map(function(s) {
            return (
              <div key={s.label} className="stat-card" style={{
                background: "var(--bg-card)", borderRadius: "14px",
                border: "1px solid var(--border)", padding: "18px 20px",
                animation: "fadeIn 0.4s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                  <span style={{ fontSize: "18px" }}>{s.icon}</span>
                </div>
                <p style={{ fontSize: "28px", fontWeight: "700", margin: 0, color: s.color }}>{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* ── USAGE + GHL STATUS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>

          {/* Usage */}
          <div style={{ background: "var(--bg-card)", borderRadius: "14px", border: "1px solid var(--border)", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", margin: 0 }}>Monthly Usage</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                <span style={{ color: usagePct > 90 ? "var(--danger)" : "var(--text)" }}>{thisMonthCount}</span>
                {" / " + analysisLimit}
              </p>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "4px",
                width: usagePct + "%",
                background: usagePct > 90 ? "var(--danger)" : usagePct > 70 ? "var(--warning)" : "var(--brand)",
                transition: "width 1s ease",
              }} />
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "8px 0 0" }}>
              {analysisLimit - thisMonthCount} analyses remaining this month
            </p>
          </div>

          {/* GHL Status */}
          <div style={{
            background: "var(--bg-card)", borderRadius: "14px", padding: "18px 20px",
            border: "1px solid " + (tenant.ghl_enabled ? "rgba(57,255,20,0.2)" : "rgba(255,165,0,0.2)"),
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: tenant.ghl_enabled ? "var(--brand)" : "#ffa500",
                  boxShadow: tenant.ghl_enabled ? "0 0 8px rgba(57,255,20,0.6)" : "0 0 8px rgba(255,165,0,0.4)",
                }} />
                <p style={{ fontSize: "13px", fontWeight: "700", margin: 0, color: "var(--text)" }}>
                  GHL {tenant.ghl_enabled ? "Connected" : "Not Connected"}
                </p>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                {tenant.ghl_enabled
                  ? ghlSynced + " contacts synced to CRM"
                  : "Connect GHL to sync contacts automatically"}
              </p>
            </div>
            {!tenant.ghl_enabled && (
              <a href="/tenant/settings#ghl" style={{
                padding: "8px 14px", borderRadius: "8px", fontSize: "12px",
                fontWeight: "700", background: "rgba(255,165,0,0.1)",
                border: "1px solid rgba(255,165,0,0.3)", color: "#ffa500",
                textDecoration: "none", whiteSpace: "nowrap",
              }}>Set up →</a>
            )}
          </div>
        </div>

        {/* ── CLIENTS TABLE SECTION ── */}
        <div style={{ background: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>

          {/* Table header bar */}
          <div style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "var(--text)", margin: 0 }}>
                Clients
              </p>
              <span style={{
                padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700",
                background: "rgba(57,255,20,0.12)", color: "var(--brand)",
              }}>{filtered.length}</span>

              {/* Filter pills */}
              <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
                {[
                  { key: "all", label: "All" },
                  { key: "ready", label: "🟢 Funding Ready" },
                  { key: "needs_work", label: "🔴 Needs Work" },
                  { key: "synced", label: "GHL Synced" },
                ].map(function(f) {
                  var isActive = activeFilter === f.key;
                  return (
                    <button key={f.key} className="filter-pill"
                      onClick={function() { setActiveFilter(f.key); }}
                      style={{
                        padding: "4px 12px", borderRadius: "20px", fontSize: "11px",
                        fontWeight: "600", cursor: "pointer", border: "1px solid",
                        borderColor: isActive ? "var(--brand)" : "var(--border)",
                        background: isActive ? "rgba(57,255,20,0.1)" : "transparent",
                        color: isActive ? "var(--brand)" : "var(--text-muted)",
                      }}>{f.label}</button>
                  );
                })}
              </div>
            </div>

            {/* Search */}
            <div style={{ position: "relative", minWidth: "220px" }}>
              <span style={{
                position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
                fontSize: "14px", color: "var(--text-muted)", pointerEvents: "none",
              }}>🔍</span>
              <input
                type="text" value={search}
                onChange={function(e) { setSearch(e.target.value); }}
                placeholder="Search clients..."
                style={{
                  width: "100%", padding: "8px 12px 8px 34px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: "13px", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", margin: "0 0 12px" }}>🔍</p>
              <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)", margin: "0 0 6px" }}>
                {search || activeFilter !== "all" ? "No clients match your filter" : "No analyses yet"}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
                {!search && activeFilter === "all" ? "Run your first analysis to get started" : "Try a different search or filter"}
              </p>
              {!search && activeFilter === "all" && (
                <a href="/analysis/new" style={{
                  padding: "10px 20px", borderRadius: "10px", fontSize: "13px",
                  fontWeight: "700", background: "var(--brand)", color: "#000",
                  textDecoration: "none", display: "inline-block",
                }}>+ New Analysis</a>
              )}
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 1.8fr 0.7fr 0.9fr 1.2fr 0.7fr 1fr 1.2fr",
                gap: "8px", padding: "10px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                {["Client", "Email", "Score", "FICO", "Funding", "GHL", "Date", "Actions"].map(function(h) {
                  return (
                    <span key={h} style={{
                      fontSize: "10px", fontWeight: "700", color: "var(--text-dim)",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>{h}</span>
                  );
                })}
              </div>

              {filtered.map(function(a, idx) {
                var name = ((a.contact_first_name || "") + " " + (a.contact_last_name || "")).trim() || "Unknown";
                var score = a.funding_score || 0;
                var date = new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return (
                  <div key={a.id} className="client-row" style={{
                    display: "grid",
                    gridTemplateColumns: "2.5fr 1.8fr 0.7fr 0.9fr 1.2fr 0.7fr 1fr 1.2fr",
                    gap: "8px", padding: "12px 20px", alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    animation: "fadeIn 0.3s ease " + (idx * 0.03) + "s both",
                  }}>

                    {/* Client */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
                        background: avatarColor(a.contact_first_name),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: "700", color: avatarTextColor(a.contact_first_name),
                      }}>{initials(a)}</div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{a.contact_phone || ""}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.contact_email || "—"}
                    </p>

                    {/* Score badge */}
                    <div>
                      <span style={{
                        display: "inline-block", padding: "4px 8px", borderRadius: "8px",
                        fontSize: "12px", fontWeight: "700",
                        background: scoreBg(score), color: scoreColor(score),
                      }}>{score}/10</span>
                    </div>

                    {/* FICO */}
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", margin: 0 }}>
                      {a.score_avg || "—"}
                    </p>

                    {/* Funding */}
                    <p style={{ fontSize: "12px", color: score >= 8 ? "var(--brand)" : "var(--text-muted)", margin: 0, fontWeight: score >= 8 ? "600" : "400" }}>
                      {a.estimated_funding || "—"}
                    </p>

                    {/* GHL */}
                    <div>
                      {a.ghl_synced ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                          background: "rgba(57,255,20,0.1)", color: "var(--brand)",
                        }}>
                          <span style={{ fontSize: "8px" }}>●</span> Synced
                        </span>
                      ) : (
                        <span style={{
                          padding: "3px 8px", borderRadius: "6px", fontSize: "11px",
                          background: "rgba(255,255,255,0.05)", color: "var(--text-dim)",
                        }}>—</span>
                      )}
                    </div>

                    {/* Date */}
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{date}</p>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <a href={"/analysis/" + a.id} className="action-btn" style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "11px",
                        fontWeight: "600", textDecoration: "none",
                        background: "rgba(57,255,20,0.1)", color: "var(--brand)",
                        border: "1px solid rgba(57,255,20,0.2)",
                      }}>View</a>
                      <button onClick={function() { handleCopyRowLink(a.id); }}
                        className="action-btn"
                        title="Copy results link"
                        style={{
                          padding: "5px 8px", borderRadius: "6px", fontSize: "12px",
                          border: "1px solid var(--border)", cursor: "pointer",
                          background: copiedId === a.id ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.04)",
                          color: copiedId === a.id ? "var(--brand)" : "var(--text-muted)",
                        }}>
                        {copiedId === a.id ? "✓" : "📋"}
                      </button>
                      {tenant.ghl_enabled && a.ghl_contact_id && (
                        <button onClick={function() { openSendModal(a); }}
                          className="action-btn"
                          title="Send results"
                          style={{
                            padding: "5px 8px", borderRadius: "6px", fontSize: "12px",
                            border: "1px solid var(--border)", cursor: "pointer",
                            background: "rgba(255,255,255,0.04)", color: "var(--text-muted)",
                          }}>✉️</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SEND MODAL ── */}
      {sendModal.open && sendModal.analysis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }} onClick={function(e) { if (e.target === e.currentTarget && !sendModal.sending) closeSendModal(); }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "20px", padding: "28px", maxWidth: "380px", width: "100%",
            animation: "fadeIn 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: "rgba(57,255,20,0.1)", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "20px",
              }}>✉️</div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text)", margin: "0 0 2px" }}>Send Results</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                  {((sendModal.analysis.contact_first_name || "") + " " + (sendModal.analysis.contact_last_name || "")).trim()}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {sendModal.analysis.contact_phone && (
                <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "12px 14px", borderRadius: "10px", background: sendModal.sendSms ? "rgba(57,255,20,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid " + (sendModal.sendSms ? "rgba(57,255,20,0.2)" : "var(--border)"), transition: "all 0.15s" }}>
                  <input type="checkbox" checked={sendModal.sendSms}
                    onChange={function(e) { setSendModal(function(prev) { return Object.assign({}, prev, { sendSms: e.target.checked }); }); }}
                    disabled={sendModal.sending}
                    style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", margin: 0 }}>SMS</p>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{sendModal.analysis.contact_phone}</p>
                  </div>
                </label>
              )}
              {sendModal.analysis.contact_email && (
                <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "12px 14px", borderRadius: "10px", background: sendModal.sendEmail ? "rgba(57,255,20,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid " + (sendModal.sendEmail ? "rgba(57,255,20,0.2)" : "var(--border)"), transition: "all 0.15s" }}>
                  <input type="checkbox" checked={sendModal.sendEmail}
                    onChange={function(e) { setSendModal(function(prev) { return Object.assign({}, prev, { sendEmail: e.target.checked }); }); }}
                    disabled={sendModal.sending}
                    style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }} />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", margin: 0 }}>Email</p>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{sendModal.analysis.contact_email}</p>
                  </div>
                </label>
              )}
            </div>

            {sendModal.result && (
              <div style={{
                padding: "12px 14px", borderRadius: "10px", marginBottom: "16px",
                background: sendModal.result.success ? "rgba(57,255,20,0.08)" : "rgba(255,68,68,0.08)",
                border: "1px solid " + (sendModal.result.success ? "rgba(57,255,20,0.3)" : "rgba(255,68,68,0.3)"),
                fontSize: "13px", color: sendModal.result.success ? "var(--brand)" : "var(--danger)",
              }}>
                {sendModal.result.success
                  ? "✓ Sent — SMS: " + (sendModal.result.smsSent ? "delivered" : "skipped") + ", Email: " + (sendModal.result.emailSent ? "delivered" : "skipped")
                  : "✗ " + (sendModal.result.error || "Failed")}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              {!sendModal.result ? (
                <>
                  <button onClick={handleSendNow}
                    disabled={sendModal.sending || (!sendModal.sendSms && !sendModal.sendEmail)}
                    style={{
                      flex: 1, padding: "12px", borderRadius: "10px", fontSize: "14px",
                      fontWeight: "700", cursor: sendModal.sending ? "not-allowed" : "pointer",
                      background: sendModal.sending ? "var(--border)" : "var(--brand)",
                      border: "none", color: sendModal.sending ? "var(--text-muted)" : "#000",
                    }}>
                    {sendModal.sending ? "Sending..." : "Send Now"}
                  </button>
                  <button onClick={closeSendModal} disabled={sendModal.sending}
                    style={{
                      padding: "12px 16px", borderRadius: "10px", fontSize: "14px",
                      border: "1px solid var(--border)", cursor: "pointer",
                      background: "transparent", color: "var(--text-muted)",
                    }}>Cancel</button>
                </>
              ) : (
                <button onClick={closeSendModal}
                  style={{
                    flex: 1, padding: "12px", borderRadius: "10px", fontSize: "14px",
                    fontWeight: "600", border: "1px solid var(--border)", cursor: "pointer",
                    background: "transparent", color: "var(--text)",
                  }}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
