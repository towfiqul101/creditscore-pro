"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  var [user, setUser] = useState(null);
  var [tenants, setTenants] = useState([]);
  var [allUsers, setAllUsers] = useState([]);
  var [allAnalyses, setAllAnalyses] = useState([]);
  var [loading, setLoading] = useState(true);
  var [activeTab, setActiveTab] = useState("users");
  var [showCreate, setShowCreate] = useState(false);
  var [editingTenant, setEditingTenant] = useState(null);
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState("");
  var router = useRouter();

  var supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  var emptyForm = {
    name: "", slug: "", owner_email: "", owner_phone: "",
    plan: "starter", notes: "",
    ghl_api_key: "", ghl_location_id: "", ghl_enabled: false,
  };
  var [form, setForm] = useState(emptyForm);

  useEffect(function () { loadData(); }, []);

  async function loadData() {
    // Auth check
    var r = await supabase.auth.getUser();
    var u = r.data.user;
    if (!u) { window.location.href = "/login"; return; }

    var profileRes = await supabase.from("profiles").select("role").eq("id", u.id).single();
    if (!profileRes.data || profileRes.data.role !== "admin") {
      window.location.href = "/dashboard";
      return;
    }
    setUser(u);

    // Load tenants
    var tenantsRes = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
    setTenants(tenantsRes.data || []);

    // Load ALL analyses (admin sees everything — no user_id filter)
    var analysesRes = await supabase
      .from("analyses")
      .select("id, contact_first_name, contact_last_name, contact_email, funding_score, funding_percentage, estimated_funding, score_avg, ghl_synced, created_at, user_id, tenant_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setAllAnalyses(analysesRes.data || []);

    // Load all auth users via profiles
    var profilesRes = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at");
    setAllUsers(profilesRes.data || []);

    setLoading(false);
  }

  function update(field, val) {
    setForm(function (prev) { return Object.assign({}, prev, { [field]: val }); });
  }

  function resetForm() {
    setForm(emptyForm);
    setShowCreate(false);
    setEditingTenant(null);
    setError("");
  }

  function startEdit(tenant) {
    setForm({
      name: tenant.name || "",
      slug: tenant.slug || "",
      owner_email: tenant.owner_email || "",
      owner_phone: tenant.owner_phone || "",
      plan: tenant.plan || "starter",
      notes: tenant.notes || "",
      ghl_api_key: tenant.ghl_api_key || "",
      ghl_location_id: tenant.ghl_location_id || "",
      ghl_enabled: tenant.ghl_enabled || false,
    });
    setEditingTenant(tenant);
    setShowCreate(true);
    setError("");
  }

  async function handleSave() {
    if (!form.name || !form.slug) { setError("Name and slug are required"); return; }
    setSaving(true);
    setError("");

    var slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    var payload = {
      name: form.name, slug: slug,
      owner_email: form.owner_email, owner_phone: form.owner_phone,
      plan: form.plan, notes: form.notes,
      ghl_api_key: form.ghl_api_key || null,
      ghl_location_id: form.ghl_location_id || null,
      ghl_enabled: form.ghl_enabled && !!form.ghl_api_key && !!form.ghl_location_id,
    };

    var res;
    if (editingTenant) {
      res = await supabase.from("tenants").update(payload).eq("id", editingTenant.id);
    } else {
      res = await supabase.from("tenants").insert(payload);
    }

    if (res.error) { setError(res.error.message); setSaving(false); return; }
    await loadData();
    resetForm();
    setSaving(false);
  }

  async function handleDeleteTenant(id, name) {
    if (!window.confirm("Delete tenant " + name + "? This cannot be undone.")) return;
    await supabase.from("tenants").delete().eq("id", id);
    await loadData();
  }

  async function handleDeleteAnalysis(id, name) {
    if (!window.confirm("Delete analysis for " + name + "?")) return;
    await supabase.from("analyses").delete().eq("id", id);
    setAllAnalyses(function (prev) { return prev.filter(function (a) { return a.id !== id; }); });
  }

  // ── Stats ────────────────────────────────────────────
  var now = new Date();
  var thisMonthAnalyses = allAnalyses.filter(function (a) {
    var d = new Date(a.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  var fundingReady = allAnalyses.filter(function (a) { return (a.funding_score || 0) >= 8; });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading admin...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", padding: "24px 16px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>Admin Dashboard</h1>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>CreditScore Pro — Owner View</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <a href="/dashboard" style={{
              padding: "9px 16px", borderRadius: "10px", fontSize: "13px",
              border: "1.5px solid var(--border)", color: "var(--text-muted)",
              textDecoration: "none", fontWeight: "500",
            }}>My Dashboard</a>
            <button onClick={function () { setShowCreate(true); setEditingTenant(null); setForm(emptyForm); }}
              style={{
                padding: "9px 16px", borderRadius: "10px", fontSize: "13px",
                background: "var(--brand)", border: "none", color: "#000",
                fontWeight: "700", cursor: "pointer",
              }}>+ Add Tenant</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Total Users", value: allUsers.length },
            { label: "Total Tenants", value: tenants.length },
            { label: "Total Analyses", value: allAnalyses.length },
            { label: "This Month", value: thisMonthAnalyses.length },
          ].map(function (s) {
            return (
              <div key={s.label} style={{
                background: "var(--bg-card)", borderRadius: "12px",
                border: "1px solid var(--border)", padding: "16px",
              }}>
                <p style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>{s.value}</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
          {["users", "analyses", "tenants"].map(function (tab) {
            return (
              <button key={tab} onClick={function () { setActiveTab(tab); }}
                style={{
                  padding: "8px 18px", borderRadius: "8px", fontSize: "13px",
                  fontWeight: "600", cursor: "pointer", border: "none",
                  textTransform: "capitalize",
                  background: activeTab === tab ? "var(--brand)" : "var(--bg-card)",
                  color: activeTab === tab ? "#000" : "var(--text-muted)",
                }}>
                {tab === "users" ? "Users (" + allUsers.length + ")" :
                  tab === "analyses" ? "Analyses (" + allAnalyses.length + ")" :
                  "Tenants (" + tenants.length + ")"}
              </button>
            );
          })}
        </div>

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div style={{ background: "var(--bg-card)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
            {allUsers.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                No users yet
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Name", "Role", "Analyses", "Joined"].map(function (h) {
                      return (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "var(--text-dim)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(function (u) {
                    var userAnalyses = allAnalyses.filter(function (a) { return a.user_id === u.id; });
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 2px", color: "var(--text)" }}>
                            {u.full_name || "No name"}
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{u.id.slice(0, 8)}...</p>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                            background: u.role === "admin" ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.06)",
                            color: u.role === "admin" ? "var(--brand)" : "var(--text-muted)",
                          }}>{u.role || "user"}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "var(--text)", fontWeight: "600" }}>
                          {userAnalyses.length}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-muted)" }}>
                          {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ANALYSES TAB */}
        {activeTab === "analyses" && (
          <div style={{ background: "var(--bg-card)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
            {allAnalyses.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                No analyses yet
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Client", "Score", "Funding", "GHL", "Date", ""].map(function (h) {
                      return (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "var(--text-dim)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allAnalyses.map(function (a) {
                    var name = ((a.contact_first_name || "") + " " + (a.contact_last_name || "")).trim() || "Unknown";
                    var score = a.funding_score || 0;
                    var color = score >= 8 ? "var(--brand)" : score >= 5 ? "var(--warning)" : "var(--danger)";
                    return (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 2px", color: "var(--text)" }}>{name}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{a.contact_email || ""}</p>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: color }}>{score}/10</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text)" }}>
                          {a.estimated_funding || "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                            background: a.ghl_synced ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.06)",
                            color: a.ghl_synced ? "var(--brand)" : "var(--text-dim)",
                          }}>{a.ghl_synced ? "Synced" : "Not synced"}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-muted)" }}>
                          {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <a href={"/analysis/" + a.id} style={{
                              padding: "5px 10px", borderRadius: "6px", fontSize: "11px",
                              fontWeight: "600", textDecoration: "none",
                              background: "rgba(57,255,20,0.1)", color: "var(--brand)",
                              border: "1px solid rgba(57,255,20,0.2)",
                            }}>View</a>
                            <button onClick={function () { handleDeleteAnalysis(a.id, name); }}
                              style={{
                                padding: "5px 10px", borderRadius: "6px", fontSize: "11px",
                                fontWeight: "600", cursor: "pointer",
                                background: "rgba(255,68,68,0.1)", color: "var(--danger)",
                                border: "1px solid rgba(255,68,68,0.2)",
                              }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TENANTS TAB */}
        {activeTab === "tenants" && (
          <div style={{ background: "var(--bg-card)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
            {tenants.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                No tenants yet — click "+ Add Tenant" to create one
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Business", "Plan", "GHL", "Analyses", ""].map(function (h) {
                      return (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "var(--text-dim)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(function (t) {
                    var tenantAnalyses = allAnalyses.filter(function (a) { return a.tenant_id === t.id; });
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 2px", color: "var(--text)" }}>{t.name}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{t.owner_email || t.slug}</p>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize",
                            background: t.plan === "pro" ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.06)",
                            color: t.plan === "pro" ? "var(--brand)" : "var(--text-muted)",
                          }}>{t.plan || "starter"}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
                            background: t.ghl_enabled ? "rgba(57,255,20,0.15)" : "rgba(255,255,255,0.06)",
                            color: t.ghl_enabled ? "var(--brand)" : "var(--text-dim)",
                          }}>{t.ghl_enabled ? "Connected" : "Off"}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                          {tenantAnalyses.length}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={function () { startEdit(t); }}
                              style={{
                                padding: "5px 10px", borderRadius: "6px", fontSize: "11px",
                                fontWeight: "600", cursor: "pointer",
                                background: "rgba(57,255,20,0.1)", color: "var(--brand)",
                                border: "1px solid rgba(57,255,20,0.2)",
                              }}>Edit</button>
                            <button onClick={function () { handleDeleteTenant(t.id, t.name); }}
                              style={{
                                padding: "5px 10px", borderRadius: "6px", fontSize: "11px",
                                fontWeight: "600", cursor: "pointer",
                                background: "rgba(255,68,68,0.1)", color: "var(--danger)",
                                border: "1px solid rgba(255,68,68,0.2)",
                              }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CREATE / EDIT MODAL */}
        {showCreate && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: "20px",
          }}>
            <div style={{
              background: "var(--bg-card)", borderRadius: "16px",
              border: "1px solid var(--border)", padding: "28px 24px",
              width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto",
            }}>
              <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 20px", color: "var(--text)" }}>
                {editingTenant ? "Edit Tenant" : "Add New Tenant"}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <ModalField label="Business Name *" value={form.name} onChange={function (v) { update("name", v); }} placeholder="Elite Credit Repair" />
                <ModalField label="Slug *" value={form.slug} onChange={function (v) { update("slug", v); }} placeholder="elite-credit" />
                <ModalField label="Owner Email" value={form.owner_email} onChange={function (v) { update("owner_email", v); }} placeholder="owner@business.com" type="email" />
                <ModalField label="Owner Phone" value={form.owner_phone} onChange={function (v) { update("owner_phone", v); }} placeholder="+1 (555) 000-0000" />

                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>Plan</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["starter", "pro", "enterprise"].map(function (p) {
                      return (
                        <button key={p} onClick={function () { update("plan", p); }}
                          style={{
                            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "12px",
                            fontWeight: "600", cursor: "pointer", textTransform: "capitalize", border: "1.5px solid",
                            borderColor: form.plan === p ? "var(--brand)" : "var(--border)",
                            background: form.plan === p ? "rgba(57,255,20,0.1)" : "transparent",
                            color: form.plan === p ? "var(--brand)" : "var(--text-muted)",
                          }}>{p}</button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", margin: "0 0 10px" }}>GHL Integration</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <ModalField label="GHL API Key" value={form.ghl_api_key} onChange={function (v) { update("ghl_api_key", v); }} placeholder="Bearer token..." />
                    <ModalField label="GHL Location ID" value={form.ghl_location_id} onChange={function (v) { update("ghl_location_id", v); }} placeholder="Location ID..." />
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input type="checkbox" id="ghl_enabled" checked={form.ghl_enabled}
                        onChange={function (e) { update("ghl_enabled", e.target.checked); }}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                      <label htmlFor="ghl_enabled" style={{ fontSize: "13px", color: "var(--text)", cursor: "pointer" }}>
                        Enable GHL sync
                      </label>
                    </div>
                  </div>
                </div>

                <ModalField label="Notes" value={form.notes} onChange={function (v) { update("notes", v); }} placeholder="Internal notes..." />

                {error && (
                  <div style={{
                    padding: "10px 14px", borderRadius: "8px",
                    background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)",
                    color: "var(--danger)", fontSize: "13px",
                  }}>{error}</div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button onClick={resetForm}
                    style={{
                      flex: 1, padding: "12px", borderRadius: "10px", fontSize: "13px",
                      fontWeight: "600", cursor: "pointer",
                      background: "transparent", border: "1.5px solid var(--border)", color: "var(--text-muted)",
                    }}>Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    style={{
                      flex: 2, padding: "12px", borderRadius: "10px", fontSize: "13px",
                      fontWeight: "700", cursor: saving ? "not-allowed" : "pointer",
                      background: saving ? "var(--border)" : "var(--brand)",
                      border: "none", color: saving ? "var(--text-muted)" : "#000",
                    }}>{saving ? "Saving..." : editingTenant ? "Save Changes" : "Create Tenant"}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, placeholder, type }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>{label}</label>
      <input
        type={type || "text"}
        value={value}
        onChange={function (e) { onChange(e.target.value); }}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: "8px",
          background: "var(--bg)", border: "1.5px solid var(--border)",
          color: "var(--text)", fontSize: "13px", outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}
