"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminPage() {
  var [user, setUser] = useState(null);
  var [tenants, setTenants] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showCreate, setShowCreate] = useState(false);
  var [editingTenant, setEditingTenant] = useState(null);
  var [saving, setSaving] = useState(false);
  var [error, setError] = useState("");
  var [stats, setStats] = useState({ total: 0, active: 0, ghlConnected: 0, totalAnalyses: 0 });
  var router = useRouter();
  var supabase = createClient();

  var [form, setForm] = useState({
    name: "", slug: "", owner_email: "", owner_phone: "",
    brand_name: "", brand_color: "#39FF14",
    plan: "starter", notes: "",
    ghl_api_key: "", ghl_location_id: "", ghl_enabled: false,
  });

  useEffect(function() {
    loadData();
  }, []);

  async function loadData() {
    var result = await supabase.auth.getUser();
    var u = result.data.user;
    if (!u) { router.push("/login"); return; }

    var profileResult = await supabase.from("profiles").select("role").eq("id", u.id).single();
    if (!profileResult.data || profileResult.data.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    setUser(u);

    var response = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    var list = response.data || [];

    // Get analysis counts per tenant
    var analysisResponse = await supabase
      .from("analyses")
      .select("tenant_id, created_at");

    var allAnalyses = analysisResponse.data || [];
    var now = new Date();
    var thisMonth = now.getMonth();
    var thisYear = now.getFullYear();

    var enriched = list.map(function(t) {
      var tenantAnalyses = allAnalyses.filter(function(a) { return a.tenant_id === t.id; });
      var monthlyAnalyses = tenantAnalyses.filter(function(a) {
        var d = new Date(a.created_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
      var lastAnalysis = tenantAnalyses.length > 0 ? tenantAnalyses.sort(function(a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      })[0].created_at : null;

      return Object.assign({}, t, {
        total_analyses: tenantAnalyses.length,
        monthly_analyses: monthlyAnalyses.length,
        last_analysis_at: lastAnalysis,
      });
    });

    setTenants(enriched);
    setStats({
      total: list.length,
      active: list.filter(function(t) { return t.is_active !== false; }).length,
      ghlConnected: list.filter(function(t) { return t.ghl_enabled; }).length,
      totalAnalyses: allAnalyses.length,
    });
    setLoading(false);
  }

  function update(field, val) {
    setForm(function(prev) { return Object.assign({}, prev, { [field]: val }); });
  }

  function resetForm() {
    setForm({
      name: "", slug: "", owner_email: "", owner_phone: "",
      brand_name: "", brand_color: "#39FF14",
      plan: "starter", notes: "",
      ghl_api_key: "", ghl_location_id: "", ghl_enabled: false,
    });
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
      brand_name: tenant.brand_name || "",
      brand_color: tenant.brand_color || "#39FF14",
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
    setSaving(true);
    setError("");

    if (!form.name || !form.slug || !form.owner_email) {
      setError("Business name, slug, and client email are required");
      setSaving(false);
      return;
    }

    var slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    var payload = {
      name: form.name,
      slug: slug,
      owner_email: form.owner_email,
      owner_phone: form.owner_phone || null,
      brand_name: form.brand_name || "CreditScore Pro",
      brand_color: form.brand_color,
      plan: form.plan,
      notes: form.notes || null,
      ghl_api_key: form.ghl_api_key || null,
      ghl_location_id: form.ghl_location_id || null,
      ghl_enabled: form.ghl_enabled,
    };

    var response;
    if (editingTenant) {
      response = await supabase.from("tenants").update(payload).eq("id", editingTenant.id);
    } else {
      payload.owner_id = user.id;
      response = await supabase.from("tenants").insert(payload);
    }

    if (response.error) {
      setError((editingTenant ? "Update" : "Create") + " failed: " + response.error.message);
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    loadData();
  }

  async function handleDelete(id, name) {
    var confirmed = window.confirm("Delete client '" + name + "'? This will NOT delete their analyses.");
    if (!confirmed) return;
    await supabase.from("tenants").delete().eq("id", id);
    loadData();
  }

  async function toggleActive(id, currentStatus) {
    await supabase.from("tenants").update({ is_active: !currentStatus }).eq("id", id);
    loadData();
  }

  function getPlanBadge(plan) {
    if (plan === "agency") return { bg: "rgba(57,255,20,0.15)", color: "#39FF14", label: "Agency" };
    if (plan === "pro") return { bg: "rgba(255,184,0,0.15)", color: "#FFB800", label: "Pro" };
    return { bg: "rgba(255,255,255,0.08)", color: "#8A8A8A", label: "Starter" };
  }

  function timeAgo(dateStr) {
    if (!dateStr) return "Never";
    var now = new Date();
    var d = new Date(dateStr);
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 2592000) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(57,255,20,0.12)", color: "var(--brand)" }}>CS</div>
          <span className="text-sm font-semibold">CreditScore Pro</span>
          <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(255,184,0,0.12)", color: "var(--warning)" }}>Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Dashboard</Link>
          <button onClick={function() { setShowCreate(true); setEditingTenant(null); setError(""); }}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--brand)", color: "#000" }}>
            + Add client
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            ["Total clients", stats.total, null],
            ["Active", stats.active, "var(--brand)"],
            ["GHL connected", stats.ghlConnected, "var(--brand)"],
            ["Total analyses", stats.totalAnalyses, null],
          ].map(function(item) {
            return (
              <div key={item[0]} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{item[0]}</p>
                <p className="text-xl font-semibold" style={{ color: item[2] || "var(--text)" }}>{item[1]}</p>
              </div>
            );
          })}
        </div>

        {/* Create/Edit Form */}
        {showCreate && (
          <div className="rounded-2xl p-6 mb-6 animate-fade-up" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">{editingTenant ? "Edit Client" : "Add New Client"}</p>
              <button onClick={resetForm} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
            </div>

            <div className="space-y-5">
              {/* Client Contact */}
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--brand)" }}>Client Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Business name *" value={form.name} onChange={function(v) { update("name", v); }} placeholder="Elite Credit Repair" />
                  <FormField label="URL slug *" value={form.slug} onChange={function(v) { update("slug", v); }} placeholder="elite-credit" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FormField label="Client email *" value={form.owner_email} onChange={function(v) { update("owner_email", v); }} placeholder="faith@elitecredit.com" type="email" />
                  <FormField label="Client phone" value={form.owner_phone} onChange={function(v) { update("owner_phone", v); }} placeholder="(404) 555-1234" type="tel" />
                </div>
              </div>

              {/* Plan & Branding */}
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--brand)" }}>Plan & Branding</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Plan</label>
                    <select value={form.plan} onChange={function(e) { update("plan", e.target.value); }}
                      className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}>
                      <option value="starter">Starter — $297 one-time (50/mo)</option>
                      <option value="pro">Pro — $97/mo (500/mo + GHL)</option>
                      <option value="agency">Agency — $297/mo (unlimited + resell)</option>
                    </select>
                  </div>
                  <FormField label="Brand name (on reports)" value={form.brand_name} onChange={function(v) { update("brand_name", v); }} placeholder="CreditScore Pro" />
                </div>
              </div>

              {/* GHL Integration */}
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--brand)" }}>GoHighLevel Integration</p>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={function() { update("ghl_enabled", !form.ghl_enabled); }}
                    className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: form.ghl_enabled ? "rgba(57,255,20,0.12)" : "var(--bg)",
                      border: "1.5px solid " + (form.ghl_enabled ? "var(--brand)" : "var(--border)"),
                      color: form.ghl_enabled ? "var(--brand)" : "var(--text-muted)",
                    }}>
                    {form.ghl_enabled ? "GHL Enabled" : "GHL Disabled"}
                  </button>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {form.plan === "starter" ? "Upgrade to Pro or Agency for GHL" : (form.ghl_enabled ? "Analyses will sync to GHL" : "Click to enable")}
                  </span>
                </div>

                {form.ghl_enabled && (
                  <div className="space-y-3 animate-slide-down">
                    <FormField label="Private Integration Token" value={form.ghl_api_key} onChange={function(v) { update("ghl_api_key", v); }}
                      placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    <FormField label="Location ID" value={form.ghl_location_id} onChange={function(v) { update("ghl_location_id", v); }}
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    <div className="rounded-lg p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--brand)" }}>Setup checklist for client:</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>1. GHL → Settings → Integrations → Private Integrations → Create "CreditScore Pro"</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>2. Copy token and Location ID (from URL or Business Profile)</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>3. Create 10 custom fields: credit_score_tu/ex/eq, credit_score_avg, funding_readiness_score/pct, estimated_funding, analysis_date, criteria_passed/failed</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>4. Create workflow: trigger on tag "analysis_complete"</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Internal notes</label>
                <textarea value={form.notes} onChange={function(e) { update("notes", e.target.value); }}
                  placeholder="Payment status, onboarding notes, etc."
                  rows="3"
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}
                />
              </div>

              {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>{error}</p>}

              <div className="flex gap-3">
                <button onClick={resetForm}
                  className="px-5 py-3 rounded-xl text-sm font-medium"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--brand)", color: "#000", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving..." : (editingTenant ? "Update Client" : "Add Client")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clients List */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-medium">Your Clients</p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>{tenants.length + " total"}</p>
          </div>

          {tenants.length === 0 ? (
            <div className="px-4 py-12 text-center" style={{ background: "var(--surface)" }}>
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>No clients yet</p>
              <button onClick={function() { setShowCreate(true); }} className="text-sm" style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>
                Add your first client
              </button>
            </div>
          ) : (
            <div style={{ background: "var(--surface)" }}>
              {tenants.map(function(t) {
                var badge = getPlanBadge(t.plan);
                var isActive = t.is_active !== false;
                return (
                  <div key={t.id} className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)", opacity: isActive ? 1 : 0.5 }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Name + Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold">{t.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                          {t.ghl_enabled && (
                            <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(57,255,20,0.08)", color: "#39FF14" }}>GHL</span>
                          )}
                          {!isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(255,68,68,0.12)", color: "#FF4444" }}>Inactive</span>
                          )}
                        </div>

                        {/* Row 2: Contact */}
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {t.owner_email || "No email"}{t.owner_phone ? " · " + t.owner_phone : ""}
                        </p>

                        {/* Row 3: Usage */}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                            {"This month: "}<strong style={{ color: t.monthly_analyses > 0 ? "var(--brand)" : "var(--text-muted)" }}>{t.monthly_analyses || 0}</strong>
                            {"/" + (t.analysis_limit || "50")}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                            {"Total: " + (t.total_analyses || 0)}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                            {"Last: " + timeAgo(t.last_analysis_at)}
                          </span>
                        </div>

                        {/* Row 4: Notes */}
                        {t.notes && (
                          <p className="text-xs mt-2 px-2 py-1 rounded" style={{ background: "var(--bg)", color: "var(--text-dim)" }}>
                            {t.notes}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <button onClick={function() { toggleActive(t.id, isActive); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: isActive ? "rgba(255,184,0,0.1)" : "rgba(57,255,20,0.1)", color: isActive ? "var(--warning)" : "var(--brand)" }}>
                          {isActive ? "Pause" : "Activate"}
                        </button>
                        <button onClick={function() { startEdit(t); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(57,255,20,0.1)", color: "var(--brand)" }}>
                          Edit
                        </button>
                        <button onClick={function() { handleDelete(t.id, t.name); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>
                          Delete
                        </button>
                      </div>
                    </div>
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

function FormField(props) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{props.label}</label>
      <input
        type={props.type || "text"} value={props.value} onChange={function(e) { props.onChange(e.target.value); }}
        placeholder={props.placeholder}
        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-colors"
        style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}
        onFocus={function(e) { e.target.style.borderColor = "var(--brand)"; }}
        onBlur={function(e) { e.target.style.borderColor = "var(--border)"; }}
      />
    </div>
  );
}
