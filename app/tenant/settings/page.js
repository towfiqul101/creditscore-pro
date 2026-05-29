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
  var [notifForm, setNotifForm] = useState({ send_results_sms: true, send_results_email: true, results_sms_template: "", results_email_subject: "", notification_delay_minutes: 0 });
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
  var [savingNotif, setSavingNotif] = useState(false);
  var [savedNotif, setSavedNotif] = useState(false);

  // GHL UI state
  var [showGhlKey, setShowGhlKey] = useState(false);
  var [ghlTesting, setGhlTesting] = useState(false);
  var [ghlTestResult, setGhlTestResult] = useState(null);
  var [showGhlInstructions, setShowGhlInstructions] = useState(false);

  // Logo error
  var [logoError, setLogoError] = useState(false);

  // SMS template ref for cursor insertion
  var smsRef = useRef(null);

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
    setNotifForm({
      send_results_sms: t.send_results_sms !== false,
      send_results_email: t.send_results_email !== false,
      results_sms_template: t.results_sms_template || "Hi [firstName]! Your credit analysis is ready. Score: [score]/10. View your full report: [url]",
      results_email_subject: t.results_email_subject || "Your Credit Analysis Results Are Ready",
      notification_delay_minutes: (t.notification_delay_minutes !== null && t.notification_delay_minutes !== undefined) ? t.notification_delay_minutes : 0,
    });

    setLoading(false);
    loadQueue(t.id);
  }

  function updateProfile(k, v) { setProfileForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateBusiness(k, v) { setBusinessForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateBranding(k, v) { setBrandingForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateGhl(k, v) { setGhlForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }
  function updateNotif(k, v) { setNotifForm(function(prev) { return Object.assign({}, prev, { [k]: v }); }); }

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

  async function saveNotif() {
    setSavingNotif(true);
    await supabase.from("tenants").update({
      send_results_sms: notifForm.send_results_sms,
      send_results_email: notifForm.send_results_email,
      results_sms_template: notifForm.results_sms_template || null,
      results_email_subject: notifForm.results_email_subject || null,
      notification_delay_minutes: notifForm.notification_delay_minutes,
    }).eq("id", tenant.id);
    setSavingNotif(false);
    flashSaved(setSavedNotif);
  }

  async function loadQueue(tenantId) {
    setQueueLoading(true);
    try {
      var res = await supabase
        .from("notification_queue")
        .select("id, contact_first_name, contact_last_name, send_sms, send_email, status, scheduled_for, sent_at, last_error, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      setQueueItems(res.data || []);
    } catch (err) {
      setQueueItems([]);
    }
    setQueueLoading(false);
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

  function insertSmsChip(chip) {
    var el = smsRef.current;
    if (!el) { updateNotif("results_sms_template", notifForm.results_sms_template + chip); return; }
    var start = el.selectionStart;
    var end = el.selectionEnd;
    var val = notifForm.results_sms_template;
    var newVal = val.slice(0, start) + chip + val.slice(end);
    updateNotif("results_sms_template", newVal);
    setTimeout(function() {
      el.focus();
      el.selectionStart = start + chip.length;
      el.selectionEnd = start + chip.length;
    }, 0);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          { id: "notifications", label: "Notifications" },
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
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>Client Notifications</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 16px" }}>Automatically notify clients with their results after each analysis</p>

          {!ghlForm.ghl_enabled && (
            <div style={{
              padding: "12px 14px", borderRadius: "9px", marginBottom: "16px",
              background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.3)",
              fontSize: "13px", color: "#FFA500",
            }}>
              ⚠ GHL must be connected to send notifications. Set up GHL Integration above first.
            </div>
          )}

          <div style={fieldGap}>
            {/* Send delay */}
            <div>
              <label style={labelStyle}>When to send notifications</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                {[
                  { value: 0, label: "Immediately (as soon as analysis completes)" },
                  { value: 5, label: "After 5 minutes" },
                  { value: 60, label: "After 1 hour" },
                  { value: 360, label: "After 6 hours" },
                  { value: 1440, label: "After 24 hours" },
                  { value: -1, label: "Manual only (don't send automatically)" },
                ].map(function(opt) {
                  var selected = notifForm.notification_delay_minutes === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={function() { updateNotif("notification_delay_minutes", opt.value); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "9px 12px", borderRadius: "9px", cursor: "pointer",
                        background: selected ? "rgba(57,255,20,0.08)" : "var(--surface)",
                        border: "1.5px solid " + (selected ? "rgba(57,255,20,0.4)" : "var(--border)"),
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{
                        width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                        border: "2px solid " + (selected ? "var(--brand)" : "var(--border)"),
                        background: selected ? "var(--brand)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {selected && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#000" }} />}
                      </div>
                      <span style={{ fontSize: "13px", color: selected ? "var(--text)" : "var(--text-muted)", fontWeight: selected ? "600" : "400" }}>{opt.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SMS toggle */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                onClick={function() { updateNotif("send_results_sms", !notifForm.send_results_sms); }}
                style={{
                  width: "42px", height: "24px", borderRadius: "12px", cursor: "pointer",
                  background: notifForm.send_results_sms ? "var(--brand)" : "var(--border)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0, marginTop: "2px",
                }}>
                <div style={{
                  position: "absolute", top: "3px",
                  left: notifForm.send_results_sms ? "20px" : "3px",
                  width: "18px", height: "18px", borderRadius: "50%",
                  background: notifForm.send_results_sms ? "#000" : "var(--text-muted)",
                  transition: "left 0.2s",
                }} />
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 2px", color: "var(--text)" }}>Send SMS to client after analysis</p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Sends a text message to client{"'"}s phone with their results link</p>
              </div>
            </div>

            {/* Email toggle */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                onClick={function() { updateNotif("send_results_email", !notifForm.send_results_email); }}
                style={{
                  width: "42px", height: "24px", borderRadius: "12px", cursor: "pointer",
                  background: notifForm.send_results_email ? "var(--brand)" : "var(--border)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0, marginTop: "2px",
                }}>
                <div style={{
                  position: "absolute", top: "3px",
                  left: notifForm.send_results_email ? "20px" : "3px",
                  width: "18px", height: "18px", borderRadius: "50%",
                  background: notifForm.send_results_email ? "#000" : "var(--text-muted)",
                  transition: "left 0.2s",
                }} />
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 2px", color: "var(--text)" }}>Send Email to client after analysis</p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Sends an email to client{"'"}s email address with their results link</p>
              </div>
            </div>

            {/* SMS template */}
            <div>
              <label style={labelStyle}>SMS Template</label>
              <textarea
                ref={smsRef}
                value={notifForm.results_sms_template}
                onChange={function(e) { updateNotif("results_sms_template", e.target.value); }}
                rows={3}
                style={Object.assign({}, inputStyle, { resize: "vertical", lineHeight: 1.5 })}
                placeholder="Hi [firstName]! Your credit analysis is ready. Score: [score]/10. View your full report: [url]"
              />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {["[firstName]", "[lastName]", "[score]", "[url]"].map(function(chip) {
                  return (
                    <button key={chip} onClick={function() { insertSmsChip(chip); }}
                      style={{
                        padding: "3px 10px", borderRadius: "20px", fontSize: "12px",
                        fontWeight: "600", cursor: "pointer",
                        background: "rgba(57,255,20,0.1)", color: "var(--brand)",
                        border: "1px solid rgba(57,255,20,0.3)",
                      }}>{chip}</button>
                  );
                })}
              </div>
            </div>

            {/* Email subject */}
            <div>
              <label style={labelStyle}>Email Subject</label>
              <input
                type="text"
                value={notifForm.results_email_subject}
                onChange={function(e) { updateNotif("results_email_subject", e.target.value); }}
                style={inputStyle}
                placeholder="Your Credit Analysis Results Are Ready"
              />
            </div>

            {/* Results link preview */}
            <div style={{
              padding: "12px 14px", borderRadius: "9px",
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Results link format (what clients receive)</p>
              <p style={{ fontSize: "13px", fontFamily: "monospace", color: "var(--brand)", margin: "0 0 4px" }}>
                https://creditscore-pro.vercel.app/results/[analysis-id]
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                This is a public link — clients can view their results without creating an account
              </p>
            </div>

            <SaveBtn onClick={saveNotif} saving={savingNotif} saved={savedNotif} />

            {/* Queue status panel */}
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent Notifications (last 10)</p>
                <button
                  onClick={function() { if (tenant) loadQueue(tenant.id); }}
                  style={{ background: "none", border: "none", fontSize: "12px", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                >Refresh</button>
              </div>
              {queueLoading ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Loading...</p>
              ) : queueItems.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>No notifications sent yet.</p>
              ) : (
                <div style={{ borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr",
                    gap: "6px", padding: "8px 12px",
                    background: "var(--surface)", borderBottom: "1px solid var(--border)",
                  }}>
                    {["Client", "Type", "Status", "Scheduled"].map(function(h) {
                      return <span key={h} style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>;
                    })}
                  </div>
                  {queueItems.map(function(q) {
                    var name = ((q.contact_first_name || "") + " " + (q.contact_last_name || "")).trim() || "Unknown";
                    var type = (q.send_sms && q.send_email) ? "SMS+Email" : q.send_sms ? "SMS" : "Email";
                    var scheduled = q.status === "sent" && q.sent_at
                      ? new Date(q.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : q.scheduled_for
                      ? new Date(q.scheduled_for).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—";
                    var statusColor = q.status === "sent" ? "var(--brand)" : q.status === "failed" ? "var(--danger)" : "#FFA500";
                    var statusBg = q.status === "sent" ? "rgba(57,255,20,0.1)" : q.status === "failed" ? "rgba(255,68,68,0.1)" : "rgba(255,165,0,0.1)";
                    return (
                      <div key={q.id} style={{
                        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr",
                        gap: "6px", padding: "9px 12px", alignItems: "center",
                        borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
                      }}>
                        <span style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{type}</span>
                        <span style={{
                          display: "inline-block", padding: "2px 7px", borderRadius: "5px",
                          fontSize: "10px", fontWeight: "700", background: statusBg, color: statusColor,
                          textTransform: "capitalize",
                        }}>{q.status}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{scheduled}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
