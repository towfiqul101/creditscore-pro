"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function TenantSettingsPage() {
  var [user, setUser] = useState(null);
  var [tenant, setTenant] = useState(null);
  var [loading, setLoading] = useState(true);

  // Section forms
  var [profileForm, setProfileForm] = useState({ full_name: "", whatsapp: "", avatar_url: "" });
  var [businessForm, setBusinessForm] = useState({ name: "", ceo_name: "", owner_email: "", owner_phone: "", owner_whatsapp: "", website: "" });
  var [brandingForm, setBrandingForm] = useState({ brand_name: "", logo_url: "", brand_color: "#39FF14" });
  var [ghlForm, setGhlForm] = useState({ ghl_api_key: "", ghl_location_id: "", ghl_enabled: false });
  var [steps, setSteps] = useState([]);
  var [savingSteps, setSavingSteps] = useState(false);
  var [stepsSaved, setStepsSaved] = useState(false);
  var [queueItems, setQueueItems] = useState([]);
  var [queueLoading, setQueueLoading] = useState(false);

  // Save states
  var [savingProfile, setSavingProfile] = useState(false);
  var [savedProfile, setSavedProfile] = useState(false);
  var [savingBusiness, setSavingBusiness] = useState(false);
  var [savedBusiness, setSavedBusiness] = useState(false);
  var [savingBranding, setSavingBranding] = useState(false);
  var [savedBranding, setSavedBranding] = useState(false);
  var [savingGhl, setSavingGhl] = useState(false);
  var [savedGhl, setSavedGhl] = useState(false);

  // GHL UI state
  var [showGhlKey, setShowGhlKey] = useState(false);
  var [ghlTesting, setGhlTesting] = useState(false);
  var [ghlTestResult, setGhlTestResult] = useState(null);
  var [showGhlInstructions, setShowGhlInstructions] = useState(false);

  // Logo error
  var [logoError, setLogoError] = useState(false);

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

    var profileRes = await supabase.from("profiles").select("full_name, whatsapp, avatar_url").eq("id", u.id).single();
    var p = profileRes.data || {};

    setProfileForm({ full_name: p.full_name || "", whatsapp: p.whatsapp || "", avatar_url: p.avatar_url || "" });
    setBusinessForm({
      name: t.name || "", ceo_name: t.ceo_name || "",
      owner_email: t.owner_email || "", owner_phone: t.owner_phone || "",
      owner_whatsapp: t.owner_whatsapp || "", website: t.website || "",
    });
    setBrandingForm({
      brand_name: t.brand_name || "", logo_url: t.logo_url || "",
      brand_color: t.brand_color || "#39FF14",
    });
    setGhlForm({
      ghl_api_key: t.ghl_api_key || "", ghl_location_id: t.ghl_location_id || "",
      ghl_enabled: t.ghl_enabled || false,
    });
    setLoading(false);
    loadQueue(t.id);
    loadSteps(t.id);
  }

  function updateProfile(k, v) { setProfileForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateBusiness(k, v) { setBusinessForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateBranding(k, v) { setBrandingForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateGhl(k, v) { setGhlForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }

  function flashSaved(setFn) {
    setFn(true);
    setTimeout(function() { setFn(false); }, 2500);
  }

  async function saveProfile() {
    setSavingProfile(true);
    await supabase.from("profiles").update({
      full_name: profileForm.full_name,
      whatsapp: profileForm.whatsapp || null,
      avatar_url: profileForm.avatar_url || null,
    }).eq("id", user.id);
    setSavingProfile(false);
    flashSaved(setSavedProfile);
  }

  async function saveBusiness() {
    setSavingBusiness(true);
    await supabase.from("tenants").update({
      name: businessForm.name,
      ceo_name: businessForm.ceo_name || null,
      owner_email: businessForm.owner_email || null,
      owner_phone: businessForm.owner_phone || null,
      owner_whatsapp: businessForm.owner_whatsapp || null,
      website: businessForm.website || null,
    }).eq("id", tenant.id);
    setSavingBusiness(false);
    flashSaved(setSavedBusiness);
  }

  async function saveBranding() {
    setSavingBranding(true);
    await supabase.from("tenants").update({
      brand_name: brandingForm.brand_name || null,
      logo_url: brandingForm.logo_url || null,
      brand_color: brandingForm.brand_color || "#39FF14",
    }).eq("id", tenant.id);
    setSavingBranding(false);
    flashSaved(setSavedBranding);
  }

  async function saveGhl() {
    setSavingGhl(true);
    var enabled = ghlForm.ghl_enabled && !!ghlForm.ghl_api_key && !!ghlForm.ghl_location_id;
    await supabase.from("tenants").update({
      ghl_api_key: ghlForm.ghl_api_key || null,
      ghl_location_id: ghlForm.ghl_location_id || null,
      ghl_enabled: enabled,
    }).eq("id", tenant.id);
    setGhlForm(function(prev) { return Object.assign({}, prev, { ghl_enabled: enabled }); });
    setSavingGhl(false);
    flashSaved(setSavedGhl);
  }

  async function loadSteps(tenantId) {
    var res = await supabase
      .from("notification_steps")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("step_order", { ascending: true });
    setSteps(res.data || []);
  }

  function addStep(stepNum) {
    var newStep = {
      tenant_id: tenant.id,
      step_order: stepNum,
      delay_days: stepNum === 1 ? 0 : stepNum === 2 ? 1 : 3,
      delay_hours: 0,
      delay_minutes: 0,
      send_sms: true,
      send_email: true,
      email_type: stepNum === 1 ? "full_results" : "custom",
      email_subject: "",
      email_intro: "",
      email_body: "",
      cta_enabled: true,
      cta_text: "Book a Free Consultation",
      cta_url: "",
      sms_template: "",
      is_active: true,
    };
    setSteps(function(prev) { return prev.concat([newStep]); });
  }

  function updateStep(stepNum, updated) {
    setSteps(function(prev) {
      return prev.map(function(s) {
        return s.step_order === stepNum ? Object.assign({}, s, updated) : s;
      });
    });
  }

  function deleteStep(stepNum) {
    setSteps(function(prev) { return prev.filter(function(s) { return s.step_order !== stepNum; }); });
  }

  async function saveSteps() {
    setSavingSteps(true);
    setStepsSaved(false);
    try {
      await supabase.from("notification_steps").delete().eq("tenant_id", tenant.id);
      if (steps.length > 0) {
        var toInsert = steps.map(function(s) {
          return {
            tenant_id: tenant.id,
            step_order: s.step_order,
            delay_days: s.delay_days || 0,
            delay_hours: s.delay_hours || 0,
            delay_minutes: s.delay_minutes || 0,
            send_sms: s.send_sms !== false,
            send_email: s.send_email !== false,
            email_type: s.email_type || "full_results",
            email_subject: s.email_subject || null,
            email_intro: s.email_intro || null,
            email_body: s.email_body || null,
            cta_enabled: s.cta_enabled !== false,
            cta_text: s.cta_text || null,
            cta_url: s.cta_url || null,
            sms_template: s.sms_template || null,
            is_active: s.is_active !== false,
          };
        });
        await supabase.from("notification_steps").insert(toInsert);
      }
      setStepsSaved(true);
      setTimeout(function() { setStepsSaved(false); }, 3000);
    } catch (err) {
      alert("Save failed: " + err.message);
    }
    setSavingSteps(false);
  }

  async function loadQueue(tenantId) {
    setQueueLoading(true);
    try {
      var res = await supabase
        .from("notification_queue")
        .select("id, contact_first_name, contact_last_name, step_order, email_type, send_sms, send_email, status, scheduled_for, sent_at, last_error, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      setQueueItems(res.data || []);
    } catch (err) {
      setQueueItems([]);
    }
    setQueueLoading(false);
  }

  async function cancelQueueItem(id) {
    await supabase.from("notification_queue").update({ status: "cancelled" }).eq("id", id);
    setQueueItems(function(prev) {
      return prev.map(function(q) { return q.id === id ? Object.assign({}, q, { status: "cancelled" }) : q; });
    });
  }

  async function resendQueueItem(id) {
    await supabase.from("notification_queue").update({ status: "pending", attempts: 0, last_error: null }).eq("id", id);
    setQueueItems(function(prev) {
      return prev.map(function(q) { return q.id === id ? Object.assign({}, q, { status: "pending", attempts: 0 }) : q; });
    });
  }

  async function testGhl() {
    setGhlTesting(true);
    setGhlTestResult(null);
    try {
      var res = await fetch("/api/tenant/test-ghl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: ghlForm.ghl_api_key, locationId: ghlForm.ghl_location_id }),
      });
      var data = await res.json();
      setGhlTestResult(data);
    } catch (err) {
      setGhlTestResult({ success: false, error: "Request failed" });
    }
    setGhlTesting(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "15px", color: "var(--text)", fontWeight: "600", marginBottom: "8px" }}>No business account found.</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>Your account may not have an active subscription yet.</p>
          <a href="/dashboard" style={{ color: "var(--brand)", fontSize: "13px", textDecoration: "none" }}>← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  var inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: "9px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    color: "var(--text)", fontSize: "13px", outline: "none", boxSizing: "border-box",
  };

  var sectionStyle = {
    background: "var(--bg-card)", borderRadius: "14px",
    border: "1px solid var(--border)", padding: "24px",
    marginBottom: "16px",
  };

  var labelStyle = { display: "block", fontSize: "12px", marginBottom: "5px", color: "var(--text-muted)" };

  var fieldGap = { display: "flex", flexDirection: "column", gap: "12px" };

  function SaveBtn(props) {
    return (
      <button
        onClick={props.onClick}
        disabled={props.saving}
        style={{
          padding: "10px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: "700",
          cursor: props.saving ? "not-allowed" : "pointer", border: "none",
          background: props.saved ? "rgba(57,255,20,0.15)" : props.saving ? "var(--border)" : "var(--brand)",
          color: props.saved ? "var(--brand)" : props.saving ? "var(--text-muted)" : "#000",
          transition: "background 0.2s",
        }}>
        {props.saved ? "✓ Saved" : props.saving ? "Saving..." : "Save changes"}
      </button>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: "56px",
        background: "var(--bg)", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "rgba(57,255,20,0.12)", color: "var(--brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", fontWeight: "700",
          }}>CS</div>
          <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text)" }}>Settings</span>
        </div>
        <a href="/tenant/dashboard" style={{
          fontSize: "13px", color: "var(--text-muted)", textDecoration: "none",
        }}>← Back to Dashboard</a>
      </header>

      {/* Anchor nav */}
      <div style={{
        position: "sticky", top: "56px", zIndex: 30,
        display: "flex", gap: "4px", padding: "10px 24px",
        background: "var(--bg)", borderBottom: "1px solid var(--border)",
        overflowX: "auto",
      }}>
        {[
          { id: "profile", label: "Profile" },
          { id: "business", label: "Business" },
          { id: "branding", label: "Branding" },
          { id: "ghl", label: "GHL Integration" },
          { id: "notifications", label: "Messages" },
        ].map(function(s) {
          return (
            <a key={s.id} href={"#" + s.id} style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "13px",
              fontWeight: "500", textDecoration: "none", whiteSpace: "nowrap",
              background: "var(--bg-card)", color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}>{s.label}</a>
          );
        })}
      </div>

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "28px 24px" }}>

        {/* ── SECTION 1: PROFILE ── */}
        <section id="profile" style={sectionStyle}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>Your Profile</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>Your personal account details</p>
          <div style={fieldGap}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" value={profileForm.full_name} onChange={function(e) { updateProfile("full_name", e.target.value); }} style={inputStyle} placeholder="Your full name" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <div style={{ position: "relative" }}>
                <input type="email" value={user.email || ""} readOnly style={Object.assign({}, inputStyle, { opacity: 0.6, paddingRight: "36px" })} />
                <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", pointerEvents: "none" }}>🔒</span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "4px 0 0" }}>Email cannot be changed here</p>
            </div>
            <div>
              <label style={labelStyle}>WhatsApp Number</label>
              <input type="tel" value={profileForm.whatsapp} onChange={function(e) { updateProfile("whatsapp", e.target.value); }} style={inputStyle} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label style={labelStyle}>Display Photo URL</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="text" value={profileForm.avatar_url} onChange={function(e) { updateProfile("avatar_url", e.target.value); }} style={Object.assign({}, inputStyle, { flex: 1 })} placeholder="https://..." />
                {profileForm.avatar_url && (
                  <img src={profileForm.avatar_url} alt="avatar" onError={function(e) { e.target.style.display = "none"; }}
                    style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)", flexShrink: 0 }} />
                )}
              </div>
            </div>
            <SaveBtn onClick={saveProfile} saving={savingProfile} saved={savedProfile} />
          </div>
        </section>

        {/* ── SECTION 2: BUSINESS ── */}
        <section id="business" style={sectionStyle}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>Business Information</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>Your company details visible on reports and communications</p>
          <div style={fieldGap}>
            <div>
              <label style={labelStyle}>Business Name</label>
              <input type="text" value={businessForm.name} onChange={function(e) { updateBusiness("name", e.target.value); }} style={inputStyle} placeholder="Elite Credit Repair LLC" />
            </div>
            <div>
              <label style={labelStyle}>CEO / Owner Name</label>
              <input type="text" value={businessForm.ceo_name} onChange={function(e) { updateBusiness("ceo_name", e.target.value); }} style={inputStyle} placeholder="Your name" />
            </div>
            <div>
              <label style={labelStyle}>Business Email</label>
              <input type="email" value={businessForm.owner_email} onChange={function(e) { updateBusiness("owner_email", e.target.value); }} style={inputStyle} placeholder="contact@yourbusiness.com" />
            </div>
            <div>
              <label style={labelStyle}>Business Phone</label>
              <input type="tel" value={businessForm.owner_phone} onChange={function(e) { updateBusiness("owner_phone", e.target.value); }} style={inputStyle} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp (Business)</label>
              <input type="tel" value={businessForm.owner_whatsapp} onChange={function(e) { updateBusiness("owner_whatsapp", e.target.value); }} style={inputStyle} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input type="text" value={businessForm.website} onChange={function(e) { updateBusiness("website", e.target.value); }} style={inputStyle} placeholder="https://yourbusiness.com" />
            </div>
            <SaveBtn onClick={saveBusiness} saving={savingBusiness} saved={savedBusiness} />
          </div>
        </section>

        {/* ── SECTION 3: BRANDING ── */}
        <section id="branding" style={sectionStyle}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>Branding</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>Customize how your reports and client-facing pages appear</p>
          <div style={fieldGap}>
            <div>
              <label style={labelStyle}>Brand Name</label>
              <input type="text" value={brandingForm.brand_name} onChange={function(e) { updateBranding("brand_name", e.target.value); }} style={inputStyle} placeholder="CreditScore Pro" />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "4px 0 0" }}>Appears on PDF reports and the client results page</p>
            </div>
            <div>
              <label style={labelStyle}>Logo URL</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input type="text" value={brandingForm.logo_url} onChange={function(e) { updateBranding("logo_url", e.target.value); setLogoError(false); }} style={Object.assign({}, inputStyle, { flex: 1 })} placeholder="https://yourdomain.com/logo.png" />
                {brandingForm.logo_url && !logoError && (
                  <img
                    src={brandingForm.logo_url} alt="logo"
                    onError={function() { setLogoError(true); }}
                    style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "contain", border: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}
                  />
                )}
                {brandingForm.logo_url && logoError && (
                  <div style={{ width: "48px", height: "48px", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "center" }}>Not found</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Brand Color</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="color"
                  value={brandingForm.brand_color}
                  onChange={function(e) { updateBranding("brand_color", e.target.value); }}
                  style={{ width: "44px", height: "40px", borderRadius: "8px", border: "1.5px solid var(--border)", cursor: "pointer", padding: "2px", background: "var(--bg)", flexShrink: 0 }}
                />
                <input
                  type="text"
                  value={brandingForm.brand_color}
                  onChange={function(e) {
                    var v = e.target.value;
                    updateBranding("brand_color", v);
                  }}
                  style={Object.assign({}, inputStyle, { fontFamily: "monospace", maxWidth: "120px" })}
                  placeholder="#39FF14"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Live preview */}
            <div style={{
              borderRadius: "12px", border: "2px solid var(--border)",
              borderLeft: "4px solid " + (brandingForm.brand_color || "#39FF14"),
              padding: "18px 20px", background: "var(--surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                {brandingForm.logo_url && !logoError ? (
                  <img src={brandingForm.logo_url} alt="preview" style={{ height: "28px", borderRadius: "4px", objectFit: "contain" }} onError={function() { setLogoError(true); }} />
                ) : (
                  <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: (brandingForm.brand_color || "#39FF14") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: brandingForm.brand_color || "#39FF14" }}>CS</div>
                )}
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>{brandingForm.brand_name || "Your Brand"}</span>
              </div>
              <p style={{ fontSize: "12px", fontWeight: "600", margin: "0 0 8px", color: "var(--text)" }}>Credit Analysis Report</p>
              <div style={{ height: "3px", borderRadius: "2px", background: brandingForm.brand_color || "#39FF14", marginBottom: "10px" }} />
              <div style={{ display: "flex", gap: "16px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Score: <b style={{ color: brandingForm.brand_color || "#39FF14" }}>8/10</b></span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Funding: <b style={{ color: "var(--text)" }}>$50K–$100K</b></span>
              </div>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "10px 0 0" }}>Powered by CreditScore Pro ™</p>
            </div>

            <SaveBtn onClick={saveBranding} saving={savingBranding} saved={savedBranding} />
          </div>
        </section>

        {/* ── SECTION 4: GHL ── */}
        <section id="ghl" style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "var(--text)" }}>GoHighLevel Integration</h2>
            <span style={{
              display: "flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: "600",
              padding: "4px 10px", borderRadius: "20px",
              background: ghlForm.ghl_enabled ? "rgba(57,255,20,0.12)" : "rgba(255,68,68,0.1)",
              color: ghlForm.ghl_enabled ? "var(--brand)" : "var(--danger)",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: ghlForm.ghl_enabled ? "var(--brand)" : "var(--danger)", display: "inline-block" }} />
              {ghlForm.ghl_enabled ? "Connected" : "Not connected"}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>Connect your GHL account to sync contacts and send automated messages</p>

          <div style={fieldGap}>
            <div>
              <label style={labelStyle}>GHL API Key (Private Integration Token)</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showGhlKey ? "text" : "password"}
                  value={ghlForm.ghl_api_key}
                  onChange={function(e) { updateGhl("ghl_api_key", e.target.value); }}
                  style={Object.assign({}, inputStyle, { paddingRight: "44px", fontFamily: showGhlKey ? "inherit" : "monospace" })}
                  placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <button
                  onClick={function() { setShowGhlKey(function(v) { return !v; }); }}
                  style={{
                    position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", fontSize: "14px", padding: "2px",
                  }}>{showGhlKey ? "🙈" : "👁"}</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>GHL Location ID</label>
              <input
                type="text"
                value={ghlForm.ghl_location_id}
                onChange={function(e) { updateGhl("ghl_location_id", e.target.value); }}
                style={inputStyle}
                placeholder="Your Location ID from GHL URL or Business Profile"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                onClick={function() { updateGhl("ghl_enabled", !ghlForm.ghl_enabled); }}
                style={{
                  width: "42px", height: "24px", borderRadius: "12px", cursor: "pointer",
                  background: ghlForm.ghl_enabled ? "var(--brand)" : "var(--border)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}>
                <div style={{
                  position: "absolute", top: "3px",
                  left: ghlForm.ghl_enabled ? "20px" : "3px",
                  width: "18px", height: "18px", borderRadius: "50%",
                  background: ghlForm.ghl_enabled ? "#000" : "var(--text-muted)",
                  transition: "left 0.2s",
                }} />
              </div>
              <label style={{ fontSize: "13px", color: "var(--text)", cursor: "pointer" }}
                onClick={function() { updateGhl("ghl_enabled", !ghlForm.ghl_enabled); }}>
                Enable GHL Sync
              </label>
            </div>

            {/* Test + Save */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={testGhl}
                disabled={ghlTesting || !ghlForm.ghl_api_key || !ghlForm.ghl_location_id}
                style={{
                  padding: "10px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600",
                  cursor: (ghlTesting || !ghlForm.ghl_api_key || !ghlForm.ghl_location_id) ? "not-allowed" : "pointer",
                  background: "transparent", border: "1.5px solid var(--border)",
                  color: "var(--text-muted)", opacity: (!ghlForm.ghl_api_key || !ghlForm.ghl_location_id) ? 0.5 : 1,
                }}>
                {ghlTesting ? "Testing..." : "Test Connection"}
              </button>
              <SaveBtn onClick={saveGhl} saving={savingGhl} saved={savedGhl} />
            </div>

            {ghlTestResult && (
              <div style={{
                padding: "10px 14px", borderRadius: "8px",
                background: ghlTestResult.success ? "rgba(57,255,20,0.08)" : "rgba(255,68,68,0.08)",
                border: "1px solid " + (ghlTestResult.success ? "rgba(57,255,20,0.3)" : "rgba(255,68,68,0.3)"),
                color: ghlTestResult.success ? "var(--brand)" : "var(--danger)",
                fontSize: "13px",
              }}>
                {ghlTestResult.success ? "✓ " + ghlTestResult.message : "✗ " + ghlTestResult.error}
              </div>
            )}

            {/* Setup instructions (collapsible) */}
            <div>
              <button
                onClick={function() { setShowGhlInstructions(function(v) { return !v; }); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "13px", color: "var(--text-muted)", padding: 0,
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                {showGhlInstructions ? "▾" : "▸"} How to get your GHL credentials
              </button>
              {showGhlInstructions && (
                <div style={{
                  marginTop: "12px", padding: "16px 18px", borderRadius: "10px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7,
                }}>
                  <ol style={{ margin: 0, paddingLeft: "18px" }}>
                    <li>In GHL: Settings → Integrations → Private Integrations</li>
                    <li>Click "Create new integration", name it "CreditScore Pro"</li>
                    <li>Permissions: Contacts (read/write), Conversations (read/write)</li>
                    <li>Copy the token — this is your GHL API Key</li>
                    <li>Location ID: GHL → Settings → Business Profile, or in your GHL URL</li>
                    <li>Create these custom fields in Contacts → Custom Fields:<br/>
                      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text)" }}>
                        credit_score_tu, credit_score_ex, credit_score_eq, credit_score_avg,<br/>
                        funding_readiness_score, funding_readiness_pct, estimated_funding,<br/>
                        analysis_date, criteria_passed, criteria_failed
                      </span>
                    </li>
                    <li>Create a workflow triggered by tag <b>analysis_complete</b> for automation</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION 5: NOTIFICATIONS ── */}
        <div id="notifications" style={{
          background: "var(--bg-card)", borderRadius: "16px",
          border: "1px solid var(--border)", padding: "28px 24px",
          marginBottom: "16px",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>
            Message Sequence
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 24px" }}>
            Automatically send clients their results after each analysis. Set up to 3 messages at different times.
          </p>

          {!ghlForm.ghl_enabled && (
            <div style={{
              padding: "12px 16px", borderRadius: "10px", marginBottom: "20px",
              background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.25)",
              fontSize: "13px", color: "#FFA500",
            }}>
              ⚠ GHL must be connected to send notifications.
              <a href="#ghl" style={{ color: "#FFA500", marginLeft: "8px", fontWeight: "600" }}>
                Set up GHL Integration ↑
              </a>
            </div>
          )}

          {[1, 2, 3].map(function(stepNum) {
            var step = steps.find(function(s) { return s.step_order === stepNum; });
            var isAdded = !!step;

            if (!isAdded && stepNum > 1 && !steps.find(function(s) { return s.step_order === stepNum - 1; })) {
              return null;
            }

            if (!isAdded) {
              return (
                <button key={stepNum}
                  onClick={function() { addStep(stepNum); }}
                  style={{
                    width: "100%", padding: "16px", borderRadius: "12px",
                    border: "2px dashed var(--border)", background: "transparent",
                    color: "var(--text-muted)", fontSize: "13px", fontWeight: "600",
                    cursor: "pointer", marginBottom: "12px", textAlign: "center",
                  }}>
                  + Add Message {stepNum}{stepNum === 1 ? " (Initial Results)" : stepNum === 2 ? " (Follow-up)" : " (Final Push)"}
                </button>
              );
            }

            return (
              <StepCard
                key={stepNum}
                stepNum={stepNum}
                step={step}
                tenant={tenant}
                onChange={function(updated) { updateStep(stepNum, updated); }}
                onDelete={function() { deleteStep(stepNum); }}
              />
            );
          })}

          {steps.length > 0 && (
            <button
              onClick={saveSteps}
              disabled={savingSteps}
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                background: stepsSaved ? "rgba(57,255,20,0.15)" : savingSteps ? "var(--border)" : "var(--brand)",
                border: "none",
                color: stepsSaved ? "var(--brand)" : savingSteps ? "var(--text-muted)" : "#000",
                fontSize: "14px", fontWeight: "700",
                cursor: savingSteps ? "not-allowed" : "pointer",
                marginTop: "16px",
              }}>
              {savingSteps ? "Saving..." : stepsSaved ? "✓ Sequence Saved" : "Save Message Sequence"}
            </button>
          )}

          {/* Queue status */}
          <div style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent Messages (last 10)</p>
              <button
                onClick={function() { if (tenant) loadQueue(tenant.id); }}
                style={{ background: "none", border: "none", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
                Refresh
              </button>
            </div>
            {queueLoading ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Loading...</p>
            ) : queueItems.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>No messages sent yet.</p>
            ) : (
              <div style={{ borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1fr",
                  gap: "6px", padding: "8px 12px",
                  background: "var(--surface)", borderBottom: "1px solid var(--border)",
                }}>
                  {["Client", "Message", "Status", "Scheduled", "Action"].map(function(h) {
                    return <span key={h} style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>;
                  })}
                </div>
                {queueItems.map(function(q) {
                  var name = ((q.contact_first_name || "") + " " + (q.contact_last_name || "")).trim() || "Unknown";
                  var msgLabel = "Message " + (q.step_order || 1) + " — " + (q.email_type === "full_results" ? "Full Results" : "Follow-up");
                  var scheduled = q.status === "sent" && q.sent_at
                    ? new Date(q.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : q.scheduled_for
                    ? new Date(q.scheduled_for).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—";
                  var statusColors = {
                    sent: { bg: "rgba(57,255,20,0.1)", color: "var(--brand)" },
                    failed: { bg: "rgba(255,68,68,0.1)", color: "var(--danger)" },
                    cancelled: { bg: "rgba(100,100,100,0.1)", color: "var(--text-muted)" },
                    pending: { bg: "rgba(255,165,0,0.1)", color: "#FFA500" },
                  };
                  var sc = statusColors[q.status] || statusColors.pending;
                  return (
                    <div key={q.id} style={{
                      display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1fr",
                      gap: "6px", padding: "9px 12px", alignItems: "center",
                      borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
                    }}>
                      <span style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msgLabel}</span>
                      <span style={{
                        display: "inline-block", padding: "2px 7px", borderRadius: "5px",
                        fontSize: "10px", fontWeight: "700", background: sc.bg, color: sc.color,
                        textTransform: "capitalize",
                      }}>{q.status}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{scheduled}</span>
                      <div>
                        {q.status === "pending" && (
                          <button onClick={function() { cancelQueueItem(q.id); }}
                            style={{
                              padding: "2px 8px", borderRadius: "5px", fontSize: "10px",
                              fontWeight: "600", cursor: "pointer",
                              background: "rgba(255,68,68,0.08)", color: "var(--danger)",
                              border: "1px solid rgba(255,68,68,0.2)",
                            }}>Cancel</button>
                        )}
                        {q.status === "failed" && (
                          <button onClick={function() { resendQueueItem(q.id); }}
                            style={{
                              padding: "2px 8px", borderRadius: "5px", fontSize: "10px",
                              fontWeight: "600", cursor: "pointer",
                              background: "rgba(57,255,20,0.08)", color: "var(--brand)",
                              border: "1px solid rgba(57,255,20,0.2)",
                            }}>Resend</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StepCard({ stepNum, step, tenant, onChange, onDelete }) {
  var defaultSmsTemplate = "Hi [firstName]! Your credit analysis is ready. Score: [score]/10. View your full report: [url]";
  var defaultEmailSubject = stepNum === 1
    ? "Your Credit Analysis Report Is Ready"
    : stepNum === 2
    ? "Following Up On Your Credit Analysis"
    : "Your Credit Journey Starts Here";

  var delayDays = step.delay_days || 0;
  var delayHours = step.delay_hours || 0;
  var delayMinutes = step.delay_minutes || 0;

  function delayLabel() {
    if (delayDays === 0 && delayHours === 0 && delayMinutes === 0) return "Sends immediately after analysis";
    var parts = [];
    if (delayDays > 0) parts.push(delayDays + " day" + (delayDays !== 1 ? "s" : ""));
    if (delayHours > 0) parts.push(delayHours + " hour" + (delayHours !== 1 ? "s" : ""));
    if (delayMinutes > 0) parts.push(delayMinutes + " minute" + (delayMinutes !== 1 ? "s" : ""));
    return "Sends " + parts.join(" ") + " after analysis";
  }

  function insertVariable(field, variable) {
    var current = step[field] || "";
    onChange(Object.assign({}, step, { [field]: current + variable }));
  }

  var isFullResults = (step.email_type || "full_results") === "full_results";
  var brandColor = (tenant && tenant.brand_color) ? tenant.brand_color : "var(--brand)";

  var fieldStyle = {
    width: "100%", padding: "11px 14px", borderRadius: "10px",
    background: "var(--bg-card)", border: "1.5px solid var(--border)",
    color: "var(--text)", fontSize: "13px", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--border)",
      borderRadius: "14px", padding: "20px", marginBottom: "16px",
      opacity: step.is_active === false ? 0.6 : 1,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "var(--brand)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "13px", fontWeight: "700", color: "#000", flexShrink: 0,
          }}>{stepNum}</div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "700", margin: 0, color: "var(--text)" }}>
              {stepNum === 1 ? "Initial Results" : stepNum === 2 ? "Follow-up" : "Final Push"}
            </p>
            <p style={{ fontSize: "11px", color: "var(--brand)", margin: 0, fontWeight: "600" }}>{delayLabel()}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <div
              onClick={function() { onChange(Object.assign({}, step, { is_active: !step.is_active })); }}
              style={{
                width: "36px", height: "20px", borderRadius: "10px", cursor: "pointer",
                background: step.is_active !== false ? "var(--brand)" : "var(--border)",
                position: "relative", transition: "background 0.2s",
              }}>
              <div style={{
                position: "absolute", top: "3px",
                left: step.is_active !== false ? "18px" : "3px",
                width: "14px", height: "14px", borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
              }} />
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Active</span>
          </label>
          <button
            onClick={function() { if (window.confirm("Delete Message " + stepNum + "?")) { onDelete(); } }}
            style={{
              padding: "6px 10px", borderRadius: "8px", fontSize: "12px",
              background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)",
              color: "var(--danger)", cursor: "pointer", fontWeight: "600",
            }}>
            Delete
          </button>
        </div>
      </div>

      {/* When to send */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>When to Send</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {[
            { label: "Days", field: "delay_days", val: delayDays },
            { label: "Hours", field: "delay_hours", val: delayHours },
            { label: "Minutes", field: "delay_minutes", val: delayMinutes },
          ].map(function(item) {
            return (
              <div key={item.field} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 4px" }}>{item.label}</p>
                <input
                  type="number" min="0"
                  value={item.val}
                  onChange={function(e) { onChange(Object.assign({}, step, { [item.field]: Math.max(0, parseInt(e.target.value) || 0) })); }}
                  style={Object.assign({}, fieldStyle, { width: "70px", textAlign: "center", fontSize: "16px", fontWeight: "700", padding: "10px 8px" })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Send via */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Send Via</p>
        <div style={{ display: "flex", gap: "10px" }}>
          {[{ label: "Email", field: "send_email" }, { label: "SMS", field: "send_sms" }].map(function(ch) {
            var isOn = step[ch.field] !== false;
            return (
              <button key={ch.field}
                onClick={function() { onChange(Object.assign({}, step, { [ch.field]: !isOn })); }}
                style={{
                  padding: "8px 20px", borderRadius: "20px", fontSize: "13px",
                  fontWeight: "600", cursor: "pointer", border: "1.5px solid",
                  borderColor: isOn ? "var(--brand)" : "var(--border)",
                  background: isOn ? "rgba(57,255,20,0.1)" : "transparent",
                  color: isOn ? "var(--brand)" : "var(--text-muted)",
                }}>
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Email settings */}
      {step.send_email !== false && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Settings</p>

          {stepNum === 1 && (
            <div style={{ marginBottom: "14px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px" }}>Email Content</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { val: "full_results", label: "Full results report", sub: "Complete analysis with all scores, criteria, and action plan" },
                  { val: "custom", label: "Custom message", sub: "Write your own content" },
                ].map(function(opt) {
                  var selected = (step.email_type || "full_results") === opt.val;
                  return (
                    <div key={opt.val}
                      onClick={function() { onChange(Object.assign({}, step, { email_type: opt.val })); }}
                      style={{
                        padding: "12px 14px", borderRadius: "10px", cursor: "pointer",
                        border: "1.5px solid " + (selected ? "var(--brand)" : "var(--border)"),
                        background: selected ? "rgba(57,255,20,0.06)" : "transparent",
                        display: "flex", alignItems: "center", gap: "10px",
                      }}>
                      <div style={{
                        width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                        border: "2px solid " + (selected ? "var(--brand)" : "var(--border)"),
                        background: selected ? "var(--brand)" : "transparent",
                      }} />
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "600", margin: 0, color: "var(--text)" }}>{opt.label}</p>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{opt.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Email Subject</label>
            <input type="text"
              value={step.email_subject || ""}
              placeholder={defaultEmailSubject}
              onChange={function(e) { onChange(Object.assign({}, step, { email_subject: e.target.value })); }}
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
              {isFullResults ? "Opening Paragraph (shown at top of email)" : "Email Body"}
            </label>
            <textarea
              rows={isFullResults ? 3 : 5}
              value={isFullResults ? (step.email_intro || "") : (step.email_body || "")}
              placeholder={isFullResults
                ? "Your credit analysis report is ready. Below you'll find your complete credit profile breakdown..."
                : "Hi [firstName],\n\nJust following up on your credit analysis..."}
              onChange={function(e) {
                var field = isFullResults ? "email_intro" : "email_body";
                onChange(Object.assign({}, step, { [field]: e.target.value }));
              }}
              style={Object.assign({}, fieldStyle, { resize: "vertical", lineHeight: "1.5" })}
            />
            {!isFullResults && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {["[firstName]", "[lastName]", "[score]", "[url]"].map(function(v) {
                  return (
                    <button key={v}
                      onClick={function() { insertVariable("email_body", v); }}
                      style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11px",
                        background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.3)",
                        color: "var(--brand)", cursor: "pointer", fontWeight: "600",
                      }}>{v}</button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: step.cta_enabled ? "14px" : 0 }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Call-to-Action Button</p>
          <div
            onClick={function() { onChange(Object.assign({}, step, { cta_enabled: !step.cta_enabled })); }}
            style={{
              width: "36px", height: "20px", borderRadius: "10px", cursor: "pointer",
              background: step.cta_enabled ? "var(--brand)" : "var(--border)",
              position: "relative", transition: "background 0.2s",
            }}>
            <div style={{
              position: "absolute", top: "3px",
              left: step.cta_enabled ? "18px" : "3px",
              width: "14px", height: "14px", borderRadius: "50%",
              background: "#fff", transition: "left 0.2s",
            }} />
          </div>
        </div>
        {step.cta_enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Button Text</label>
              <input type="text" value={step.cta_text || ""} placeholder="Book a Free Consultation"
                onChange={function(e) { onChange(Object.assign({}, step, { cta_text: e.target.value })); }}
                style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Button Link</label>
              <input type="url" value={step.cta_url || ""} placeholder="https://calendly.com/yourbusiness"
                onChange={function(e) { onChange(Object.assign({}, step, { cta_url: e.target.value })); }}
                style={fieldStyle} />
            </div>
            {(step.cta_text || step.cta_url) && (
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 6px" }}>Preview:</p>
                <div style={{
                  display: "inline-block", padding: "10px 22px", borderRadius: "6px",
                  background: brandColor, color: "#000", fontSize: "13px", fontWeight: "700",
                }}>
                  {step.cta_text || "Book a Free Consultation"} →
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SMS */}
      {step.send_sms !== false && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>SMS Template</p>
          <textarea
            rows={3}
            value={step.sms_template || ""}
            placeholder={defaultSmsTemplate}
            onChange={function(e) { onChange(Object.assign({}, step, { sms_template: e.target.value })); }}
            style={Object.assign({}, fieldStyle, { resize: "vertical", lineHeight: "1.5" })}
          />
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
            {["[firstName]", "[lastName]", "[score]", "[url]", "[cta_url]"].map(function(v) {
              return (
                <button key={v}
                  onClick={function() { insertVariable("sms_template", v); }}
                  style={{
                    padding: "4px 10px", borderRadius: "20px", fontSize: "11px",
                    background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.3)",
                    color: "var(--brand)", cursor: "pointer", fontWeight: "600",
                  }}>{v}</button>
              );
            })}
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
            [url] = full report link · [cta_url] = your booking/checkout link · Leave blank for default
          </p>
        </div>
      )}
    </div>
  );
}
