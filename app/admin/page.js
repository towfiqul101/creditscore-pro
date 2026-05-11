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
  var router = useRouter();
  var supabase = createClient();

  var [form, setForm] = useState({
    name: "", slug: "", brand_name: "", brand_color: "#39FF14",
    plan: "starter", ghl_api_key: "", ghl_location_id: "", ghl_enabled: false,
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

    setTenants(response.data || []);
    setLoading(false);
  }

  function update(field, val) {
    setForm(function(prev) { return Object.assign({}, prev, { [field]: val }); });
  }

  function resetForm() {
    setForm({
      name: "", slug: "", brand_name: "", brand_color: "#39FF14",
      plan: "starter", ghl_api_key: "", ghl_location_id: "", ghl_enabled: false,
    });
    setShowCreate(false);
    setEditingTenant(null);
    setError("");
  }

  function startEdit(tenant) {
    setForm({
      name: tenant.name || "",
      slug: tenant.slug || "",
      brand_name: tenant.brand_name || "",
      brand_color: tenant.brand_color || "#39FF14",
      plan: tenant.plan || "starter",
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

    if (!form.name || !form.slug) {
      setError("Business name and slug are required");
      setSaving(false);
      return;
    }

    var slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    if (editingTenant) {
      var response = await supabase
        .from("tenants")
        .update({
          name: form.name,
          slug: slug,
          brand_name: form.brand_name || "CreditScore Pro",
          brand_color: form.brand_color,
          plan: form.plan,
          ghl_api_key: form.ghl_api_key || null,
          ghl_location_id: form.ghl_location_id || null,
          ghl_enabled: form.ghl_enabled,
        })
        .eq("id", editingTenant.id);

      if (response.error) {
        setError("Update failed: " + response.error.message);
        setSaving(false);
        return;
      }
    } else {
      var response = await supabase
        .from("tenants")
        .insert({
          name: form.name,
          slug: slug,
          brand_name: form.brand_name || "CreditScore Pro",
          brand_color: form.brand_color,
          plan: form.plan,
          owner_id: user.id,
          ghl_api_key: form.ghl_api_key || null,
          ghl_location_id: form.ghl_location_id || null,
          ghl_enabled: form.ghl_enabled,
        });

      if (response.error) {
        setError("Create failed: " + response.error.message);
        setSaving(false);
        return;
      }
    }

    resetForm();
    setSaving(false);
    loadData();
  }

  async function handleDelete(id, name) {
    var confirmed = window.confirm("Delete tenant '" + name + "'? This cannot be undone.");
    if (!confirmed) return;
    await supabase.from("tenants").delete().eq("id", id);
    loadData();
  }

  function getPlanBadge(plan) {
    if (plan === "agency") return { bg: "rgba(57,255,20,0.15)", color: "var(--brand)", label: "Agency $297/mo" };
    if (plan === "pro") return { bg: "rgba(255,184,0,0.15)", color: "var(--warning)", label: "Pro $97/mo" };
    return { bg: "rgba(255,255,255,0.08)", color: "var(--text-muted)", label: "Starter $297 one-time" };
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
          <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>Admin</span>
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
        <div className="mb-6">
          <h1 className="text-xl font-semibold mb-1">Client Management</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Manage your CreditScore Pro clients, plans, and GHL integrations.</p>
        </div>

        {/* Create/Edit Form */}
        {showCreate && (
          <div className="rounded-2xl p-6 mb-6 animate-fade-up" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">{editingTenant ? "Edit Client" : "Add New Client"}</p>
              <button onClick={resetForm} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
            </div>

            <div className="space-y-4">
              {/* Business Info */}
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Business Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Business name" value={form.name} onChange={function(v) { update("name", v); }} placeholder="Elite Credit Repair" />
                  <FormField label="Slug (URL identifier)" value={form.slug} onChange={function(v) { update("slug", v); }} placeholder="elite-credit" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FormField label="Brand name (on reports)" value={form.brand_name} onChange={function(v) { update("brand_name", v); }} placeholder="CreditScore Pro" />
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Plan</label>
                    <select value={form.plan} onChange={function(e) { update("plan", e.target.value); }}
                      className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}>
                      <option value="starter">Starter — $297 one-time (50/mo)</option>
                      <option value="pro">Pro — $97/mo (500/mo, PDF + GHL)</option>
                      <option value="agency">Agency — $297/mo (unlimited, resell)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GHL Integration */}
              <div>
                <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>GoHighLevel Integration</p>
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
                    {form.ghl_enabled ? "Analysis results will sync to GHL" : "Click to enable GHL sync"}
                  </span>
                </div>

                {form.ghl_enabled && (
                  <div className="space-y-3 animate-slide-down">
                    <FormField label="GHL Private Integration Token" value={form.ghl_api_key} onChange={function(v) { update("ghl_api_key", v); }}
                      placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    <FormField label="GHL Location ID" value={form.ghl_location_id} onChange={function(v) { update("ghl_location_id", v); }}
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    <div className="rounded-lg p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--brand)" }}>GHL Setup Instructions</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        1. Go to GHL Settings → Integrations → Private Integrations → Create
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        2. Name it "CreditScore Pro" and copy the token above
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        3. Location ID is in GHL → Settings → Business Profile → Company ID
                      </p>
                      <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--text-muted)" }}>
                        4. Create these custom fields in GHL: credit_score_tu, credit_score_ex, credit_score_eq, credit_score_avg, funding_readiness_score, funding_readiness_pct, estimated_funding, analysis_date, criteria_passed, criteria_failed
                      </p>
                      <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--text-muted)" }}>
                        5. Create a workflow triggered by tag "analysis_complete" for automated follow-up
                      </p>
                    </div>
                  </div>
                )}
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

        {/* Tenants List */}
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
                return (
                  <div key={t.id} className="px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-sm font-semibold">{t.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                          {t.ghl_enabled && (
                            <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(57,255,20,0.08)", color: "var(--brand)" }}>GHL Connected</span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                          {"Slug: " + t.slug + " · Created: " + new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                          {"Analyses: " + (t.analyses_this_month || 0) + " this month · Limit: " + (t.analysis_limit || "N/A") + "/mo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
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
