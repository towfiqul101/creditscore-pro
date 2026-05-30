"use client";
import { useState, useEffect, useRef } from "react";
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
  var [savingStep, setSavingStep] = useState({});
  var [savedStep, setSavedStep] = useState({});
  var [deletingStep, setDeletingStep] = useState({});
  var [previewLoading, setPreviewLoading] = useState({});
  var [previewModal, setPreviewModal] = useState(null);
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

  var smsRefs = useRef({});

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

  function updateStep(stepOrder, k, v) {
    setSteps(function(prev) {
      return prev.map(function(s) {
        return s.step_order === stepOrder ? Object.assign({}, s, { [k]: v }) : s;
      });
    });
  }

  function addStep(stepOrder) {
    setSteps(function(prev) {
      return prev.concat([{
        id: null,
        tenant_id: tenant.id,
        step_order: stepOrder,
        enabled: true,
        delay_days: 0,
        delay_hours: stepOrder === 1 ? 0 : 24,
        delay_minutes: 0,
        send_sms: false,
        send_email: true,
        email_type: stepOrder === 1 ? "full_results" : "custom",
        email_subject: stepOrder === 1 ? "Your Credit Analysis Report Is Ready" : "Following up on your credit analysis",
        email_intro: "",
        email_body: "",
        cta_enabled: false,
        cta_text: "Book a Free Consultation",
        cta_url: "",
        sms_template: "",
      }]);
    });
  }

  async function saveStep(step) {
    setSavingStep(function(prev) { return Object.assign({}, prev, { [step.step_order]: true }); });
    var upsertData = {
      tenant_id: tenant.id,
      step_order: step.step_order,
      enabled: step.enabled,
      delay_days: step.delay_days || 0,
      delay_hours: step.delay_hours || 0,
      delay_minutes: step.delay_minutes || 0,
      send_sms: step.send_sms || false,
      send_email: step.send_email !== false,
      email_type: step.email_type || "full_results",
      email_subject: step.email_subject || null,
      email_intro: step.email_intro || null,
      email_body: step.email_body || null,
      cta_enabled: step.cta_enabled || false,
      cta_text: step.cta_text || null,
      cta_url: step.cta_url || null,
      sms_template: step.sms_template || null,
      updated_at: new Date().toISOString(),
    };

    var res;
    if (step.id) {
      res = await supabase.from("notification_steps").update(upsertData).eq("id", step.id).select().single();
    } else {
      res = await supabase.from("notification_steps").insert(upsertData).select().single();
    }

    if (res.data) {
      setSteps(function(prev) {
        return prev.map(function(s) {
          return s.step_order === step.step_order ? res.data : s;
        });
      });
    }

    setSavingStep(function(prev) { return Object.assign({}, prev, { [step.step_order]: false }); });
    setSavedStep(function(prev) { return Object.assign({}, prev, { [step.step_order]: true }); });
    setTimeout(function() {
      setSavedStep(function(prev) { return Object.assign({}, prev, { [step.step_order]: false }); });
    }, 2500);
  }

  async function deleteStep(step) {
    setDeletingStep(function(prev) { return Object.assign({}, prev, { [step.step_order]: true }); });
    if (step.id) {
      await supabase.from("notification_steps").delete().eq("id", step.id);
    }
    setSteps(function(prev) { return prev.filter(function(s) { return s.step_order !== step.step_order; }); });
    setDeletingStep(function(prev) { return Object.assign({}, prev, { [step.step_order]: false }); });
  }

  async function previewStep(step) {
    setPreviewLoading(function(prev) { return Object.assign({}, prev, { [step.step_order]: true }); });
    try {
      var params = "?stepOrder=" + step.step_order + "&tenantId=" + tenant.id;
      if (step.id) params = "?stepId=" + step.id + "&tenantId=" + tenant.id;
      var res = await fetch("/api/tenant/preview-email" + params);
      var data = await res.json();
      if (data.html) {
        setPreviewModal({ html: data.html, step: step });
      }
    } catch (err) {
      console.error("Preview error:", err);
    }
    setPreviewLoading(function(prev) { return Object.assign({}, prev, { [step.step_order]: false }); });
  }

  function insertSmsChip(stepOrder, chip) {
    var el = smsRefs.current[stepOrder];
    var step = steps.find(function(s) { return s.step_order === stepOrder; });
    var current = (step && step.sms_template) || "";
    if (!el) { updateStep(stepOrder, "sms_template", current + chip); return; }
    var start = el.selectionStart;
    var end = el.selectionEnd;
    var newVal = current.slice(0, start) + chip + current.slice(end);
    updateStep(stepOrder, "sms_template", newVal);
    setTimeout(function() {
      el.focus();
      el.selectionStart = start + chip.length;
      el.selectionEnd = start + chip.length;
    }, 0);
  }

  function formatDelay(days, hours, minutes) {
    var total = ((days || 0) * 1440) + ((hours || 0) * 60) + (minutes || 0);
    if (total === 0) return "Sends immediately after analysis";
    var parts = [];
    if (days > 0) parts.push(days + " day" + (days > 1 ? "s" : ""));
    if (hours > 0) parts.push(hours + " hour" + (hours > 1 ? "s" : ""));
    if (minutes > 0) parts.push(minutes + " minute" + (minutes > 1 ? "s" : ""));
    return "Sends " + parts.join(", ") + " after analysis";
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
        <section id="notifications" style={sectionStyle}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>Message Sequence</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 16px" }}>Configure automated messages sent to clients after their analysis. Up to 3 messages.</p>

          {!ghlForm.ghl_enabled && (
            <div style={{
              padding: "12px 14px", borderRadius: "9px", marginBottom: "16px",
              background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.3)",
              fontSize: "13px", color: "#FFA500",
            }}>
              ⚠ GHL must be connected to send messages. Set up GHL Integration above first.
            </div>
          )}

          {/* Step cards */}
          {[1, 2, 3].map(function(order) {
            var step = steps.find(function(s) { return s.step_order === order; });
            var prevStep = steps.find(function(s) { return s.step_order === order - 1; });
            var showAdd = !step && (order === 1 || prevStep);

            if (!step && !showAdd) return null;

            if (!step) {
              return (
                <div key={order} style={{ marginBottom: "12px" }}>
                  <button
                    onClick={function() { addStep(order); }}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "10px",
                      border: "2px dashed var(--border)", background: "transparent",
                      color: "var(--text-muted)", fontSize: "13px", fontWeight: "600",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}>
                    + Add Message {order}
                  </button>
                </div>
              );
            }

            var isFullResults = step.email_type !== "custom";
            var saving = savingStep[order];
            var saved = savedStep[order];
            var deleting = deletingStep[order];
            var previewing = previewLoading[order];
            var delayText = formatDelay(step.delay_days, step.delay_hours, step.delay_minutes);

            return (
              <div key={order} style={{
                marginBottom: "16px", borderRadius: "12px",
                border: "1.5px solid var(--border)", overflow: "hidden",
              }}>
                {/* Step header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px",
                  background: step.enabled ? "rgba(57,255,20,0.04)" : "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "50%",
                      background: step.enabled ? "var(--brand)" : "var(--border)",
                      color: step.enabled ? "#000" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: "700", flexShrink: 0,
                    }}>{order}</div>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
                      Message {order}{order === 1 ? " (required)" : " (optional)"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {order > 1 && (
                      <button
                        onClick={function() { deleteStep(step); }}
                        disabled={deleting}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--danger)", fontSize: "13px", padding: "4px 8px",
                          opacity: deleting ? 0.5 : 1,
                        }}>
                        {deleting ? "..." : "✕ Remove"}
                      </button>
                    )}
                    {/* Enable/disable toggle */}
                    <div
                      onClick={function() { updateStep(order, "enabled", !step.enabled); }}
                      style={{
                        width: "38px", height: "22px", borderRadius: "11px", cursor: "pointer",
                        background: step.enabled ? "var(--brand)" : "var(--border)",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}>
                      <div style={{
                        position: "absolute", top: "3px",
                        left: step.enabled ? "17px" : "3px",
                        width: "16px", height: "16px", borderRadius: "50%",
                        background: step.enabled ? "#000" : "var(--text-muted)",
                        transition: "left 0.2s",
                      }} />
                    </div>
                  </div>
                </div>

                {/* Step body */}
                <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>

                  {/* Delay */}
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>When to send</p>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      {[
                        { key: "delay_days", label: "days" },
                        { key: "delay_hours", label: "hours" },
                        { key: "delay_minutes", label: "min" },
                      ].map(function(d) {
                        return (
                          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <input
                              type="number"
                              min="0"
                              value={step[d.key] || 0}
                              onChange={function(e) { updateStep(order, d.key, Math.max(0, parseInt(e.target.value) || 0)); }}
                              style={Object.assign({}, inputStyle, { width: "60px", textAlign: "center", padding: "8px 6px" })}
                            />
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{d.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--brand)", margin: "6px 0 0", fontWeight: "600" }}>{delayText}</p>
                  </div>

                  {/* Channels */}
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Channel</p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {[{ key: "send_email", label: "Email" }, { key: "send_sms", label: "SMS" }].map(function(ch) {
                        var checked = step[ch.key];
                        return (
                          <div
                            key={ch.key}
                            onClick={function() { updateStep(order, ch.key, !checked); }}
                            style={{
                              display: "flex", alignItems: "center", gap: "7px", cursor: "pointer",
                              padding: "7px 12px", borderRadius: "8px",
                              background: checked ? "rgba(57,255,20,0.08)" : "var(--surface)",
                              border: "1.5px solid " + (checked ? "rgba(57,255,20,0.4)" : "var(--border)"),
                            }}>
                            <div style={{
                              width: "15px", height: "15px", borderRadius: "3px",
                              border: "2px solid " + (checked ? "var(--brand)" : "var(--border)"),
                              background: checked ? "var(--brand)" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              {checked && <span style={{ fontSize: "9px", color: "#000", fontWeight: "900" }}>✓</span>}
                            </div>
                            <span style={{ fontSize: "13px", color: checked ? "var(--text)" : "var(--text-muted)", fontWeight: checked ? "600" : "400" }}>{ch.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Email settings */}
                  {step.send_email && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ height: "1px", background: "var(--border)" }} />
                      <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Settings</p>

                      {/* Email type (only show for step 1; steps 2+ always custom) */}
                      {order === 1 && (
                        <div>
                          <p style={labelStyle}>Email type</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {[
                              { val: "full_results", label: "Full results report", desc: "Includes all scores, criteria, and priority actions" },
                              { val: "custom", label: "Custom message", desc: "Write your own email body" },
                            ].map(function(opt) {
                              var sel = (step.email_type === opt.val) || (opt.val === "full_results" && !step.email_type);
                              return (
                                <div
                                  key={opt.val}
                                  onClick={function() { updateStep(order, "email_type", opt.val); }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
                                    padding: "9px 12px", borderRadius: "9px",
                                    background: sel ? "rgba(57,255,20,0.06)" : "var(--surface)",
                                    border: "1.5px solid " + (sel ? "rgba(57,255,20,0.4)" : "var(--border)"),
                                  }}>
                                  <div style={{
                                    width: "15px", height: "15px", borderRadius: "50%", flexShrink: 0,
                                    border: "2px solid " + (sel ? "var(--brand)" : "var(--border)"),
                                    background: sel ? "var(--brand)" : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}>
                                    {sel && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#000" }} />}
                                  </div>
                                  <div>
                                    <p style={{ fontSize: "13px", fontWeight: "600", margin: 0, color: sel ? "var(--text)" : "var(--text-muted)" }}>{opt.label}</p>
                                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>{opt.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Subject */}
                      <div>
                        <label style={labelStyle}>Subject line</label>
                        <input
                          type="text"
                          value={step.email_subject || ""}
                          onChange={function(e) { updateStep(order, "email_subject", e.target.value); }}
                          style={inputStyle}
                          placeholder="Your Credit Analysis Report Is Ready"
                        />
                      </div>

                      {/* Intro or body */}
                      {isFullResults ? (
                        <div>
                          <label style={labelStyle}>Intro paragraph (shown at top of email)</label>
                          <textarea
                            value={step.email_intro || ""}
                            onChange={function(e) { updateStep(order, "email_intro", e.target.value); }}
                            rows={3}
                            style={Object.assign({}, inputStyle, { resize: "vertical", lineHeight: 1.5 })}
                            placeholder="Your credit analysis report is ready. Here's a complete breakdown of your current credit profile and funding readiness score."
                          />
                        </div>
                      ) : (
                        <div>
                          <label style={labelStyle}>Email body</label>
                          <textarea
                            value={step.email_body || ""}
                            onChange={function(e) { updateStep(order, "email_body", e.target.value); }}
                            rows={6}
                            style={Object.assign({}, inputStyle, { resize: "vertical", lineHeight: 1.6 })}
                            placeholder={"Hi [firstName],\n\nJust following up on your credit analysis. Have you had a chance to review your results?\n\nWe'd love to help you take the next step!"}
                          />
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                            {["[firstName]", "[lastName]", "[score]", "[url]"].map(function(chip) {
                              return (
                                <button key={chip}
                                  onClick={function() {
                                    updateStep(order, "email_body", (step.email_body || "") + chip);
                                  }}
                                  style={{
                                    padding: "2px 8px", borderRadius: "20px", fontSize: "11px",
                                    fontWeight: "600", cursor: "pointer",
                                    background: "rgba(57,255,20,0.08)", color: "var(--brand)",
                                    border: "1px solid rgba(57,255,20,0.3)",
                                  }}>{chip}</button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div style={{ padding: "12px 14px", borderRadius: "9px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: step.cta_enabled ? "12px" : 0 }}>
                          <div
                            onClick={function() { updateStep(order, "cta_enabled", !step.cta_enabled); }}
                            style={{
                              width: "38px", height: "22px", borderRadius: "11px", cursor: "pointer",
                              background: step.cta_enabled ? "var(--brand)" : "var(--border)",
                              position: "relative", transition: "background 0.2s", flexShrink: 0,
                            }}>
                            <div style={{
                              position: "absolute", top: "3px",
                              left: step.cta_enabled ? "17px" : "3px",
                              width: "16px", height: "16px", borderRadius: "50%",
                              background: step.cta_enabled ? "#000" : "var(--text-muted)",
                              transition: "left 0.2s",
                            }} />
                          </div>
                          <span style={{ fontSize: "13px", color: "var(--text)", fontWeight: "600" }}>Include call-to-action button</span>
                        </div>
                        {step.cta_enabled && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                              <label style={labelStyle}>Button text</label>
                              <input
                                type="text"
                                value={step.cta_text || ""}
                                onChange={function(e) { updateStep(order, "cta_text", e.target.value); }}
                                style={inputStyle}
                                placeholder="Book a Free Consultation"
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Button link</label>
                              <input
                                type="text"
                                value={step.cta_url || ""}
                                onChange={function(e) { updateStep(order, "cta_url", e.target.value); }}
                                style={inputStyle}
                                placeholder="https://calendly.com/yourbusiness"
                              />
                            </div>
                            {step.cta_url && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Preview:</span>
                                <span style={{
                                  padding: "5px 12px", borderRadius: "6px",
                                  background: "var(--brand)", color: "#000",
                                  fontSize: "12px", fontWeight: "700",
                                }}>{step.cta_text || "Book a Free Consultation"}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Preview email button */}
                      <button
                        onClick={function() { previewStep(step); }}
                        disabled={previewing}
                        style={{
                          padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                          cursor: previewing ? "not-allowed" : "pointer",
                          background: "transparent", border: "1.5px solid var(--border)",
                          color: "var(--text-muted)", alignSelf: "flex-start",
                        }}>
                        {previewing ? "Loading preview..." : "Preview Email"}
                      </button>
                    </div>
                  )}

                  {/* SMS settings */}
                  {step.send_sms && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ height: "1px", background: "var(--border)" }} />
                      <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>SMS Settings</p>
                      <div>
                        <label style={labelStyle}>SMS message</label>
                        <textarea
                          ref={function(el) { smsRefs.current[order] = el; }}
                          value={step.sms_template || ""}
                          onChange={function(e) { updateStep(order, "sms_template", e.target.value); }}
                          rows={4}
                          style={Object.assign({}, inputStyle, { resize: "vertical", lineHeight: 1.5 })}
                          placeholder={"Hi [firstName]! Your credit analysis report is ready. Score: [score]/10.\nView full report: [url]"}
                        />
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                          {["[firstName]", "[lastName]", "[score]", "[url]", "[cta_url]"].map(function(chip) {
                            return (
                              <button key={chip}
                                onClick={function() { insertSmsChip(order, chip); }}
                                style={{
                                  padding: "2px 8px", borderRadius: "20px", fontSize: "11px",
                                  fontWeight: "600", cursor: "pointer",
                                  background: "rgba(57,255,20,0.08)", color: "var(--brand)",
                                  border: "1px solid rgba(57,255,20,0.3)",
                                }}>{chip}</button>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "6px 0 0" }}>Leave blank to use the default template</p>
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={function() { saveStep(step); }}
                      disabled={saving}
                      style={{
                        padding: "10px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: "700",
                        cursor: saving ? "not-allowed" : "pointer", border: "none",
                        background: saved ? "rgba(57,255,20,0.15)" : saving ? "var(--border)" : "var(--brand)",
                        color: saved ? "var(--brand)" : saving ? "var(--text-muted)" : "#000",
                      }}>
                      {saved ? "✓ Saved" : saving ? "Saving..." : "Save message " + order}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Email preview modal */}
          {previewModal && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px",
            }}>
              <div style={{
                width: "100%", maxWidth: "680px", maxHeight: "90vh",
                background: "var(--bg-card)", borderRadius: "14px",
                border: "1px solid var(--border)", overflow: "hidden",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px", borderBottom: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
                    Email Preview — Message {previewModal.step && previewModal.step.step_order}
                  </span>
                  <button
                    onClick={function() { setPreviewModal(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", lineHeight: 1 }}>
                    ×
                  </button>
                </div>
                <div style={{ flex: 1, overflow: "auto" }}>
                  <iframe
                    srcDoc={previewModal.html}
                    style={{ width: "100%", height: "600px", border: "none" }}
                    title="Email preview"
                  />
                </div>
              </div>
            </div>
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
        </section>

      </div>
    </div>
  );
}
