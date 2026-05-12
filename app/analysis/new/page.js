"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

var STEPS = [
  { id: 1, label: "Credit Scores" },
  { id: 2, label: "Credit Profile" },
  { id: 3, label: "Contact Info" },
];

var EMPTY_FORM = {
  firstName: "", lastName: "", email: "", phone: "",
  scoreTU: "", scoreEX: "", scoreEQ: "",
  utilization: "", primaryAccounts: "", creditAge: "",
  latePayments: "0", negativeItems: "0",
  highestLimit: "", inquiries: "",
  personalInfo: "yes", errors: "no",
};

export default function NewAnalysisPage() {
  var [step, setStep] = useState(1);
  var [form, setForm] = useState(EMPTY_FORM);
  var [user, setUser] = useState(null);
  var [tenant, setTenant] = useState(null);
  var [loading, setLoading] = useState(false);
  var [pageLoading, setPageLoading] = useState(true);
  var [error, setError] = useState("");
  var [uploadMode, setUploadMode] = useState(false);
  var [uploadFile, setUploadFile] = useState(null);
  var [uploading, setUploading] = useState(false);
  var router = useRouter();
  var supabase = createClient();

  useEffect(function () {
    loadUserAndTenant();
  }, []);

  async function loadUserAndTenant() {
    try {
      var result = await supabase.auth.getUser();
      var u = result.data.user;
      if (!u) { router.push("/login"); return; }
      setUser(u);

      // Look up which tenant this user belongs to
      // maybeSingle() returns null if no row found — won't throw
      var memberResult = await supabase
        .from("tenant_members")
        .select("tenant_id, role, tenants(*)")
        .eq("user_id", u.id)
        .maybeSingle();

      if (memberResult.data && memberResult.data.tenants) {
        setTenant(memberResult.data.tenants);
      }
      // No tenant = fine, page loads normally, GHL sync just won't run
    } catch (err) {
      // DO NOT redirect to login here — user is authenticated, just no tenant
      console.error("Error loading tenant:", err);
    } finally {
      setPageLoading(false);
    }
  }

  function update(field, val) {
    setForm(function (prev) { return Object.assign({}, prev, { [field]: val }); });
  }

  function nextStep() {
    if (step === 1 && (!form.scoreTU || !form.scoreEX || !form.scoreEQ)) {
      setError("Please enter all three bureau scores");
      return;
    }
    if (step === 2 && (!form.utilization || !form.primaryAccounts || !form.creditAge || !form.highestLimit || !form.inquiries)) {
      setError("Please fill in all credit profile fields");
      return;
    }
    setError("");
    setStep(function (s) { return s + 1; });
  }

  function prevStep() { setStep(function (s) { return s - 1; }); }

  async function handleUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploading(true);
    setError("");

    try {
      var formData = new FormData();
      formData.append("file", file);

      var res = await fetch("/api/upload", { method: "POST", body: formData });
      var data = await res.json();

      if (data.success && data.extractedData) {
        var d = data.extractedData;
        setForm(function (prev) {
          return Object.assign({}, prev, {
            firstName: d.firstName || prev.firstName,
            lastName: d.lastName || prev.lastName,
            email: d.email || prev.email,
            phone: d.phone || prev.phone,
            scoreTU: d.scoreTU || prev.scoreTU,
            scoreEX: d.scoreEX || prev.scoreEX,
            scoreEQ: d.scoreEQ || prev.scoreEQ,
            utilization: d.utilization || prev.utilization,
            primaryAccounts: d.primaryAccounts || prev.primaryAccounts,
            creditAge: d.creditAge || prev.creditAge,
            latePayments: d.latePayments || prev.latePayments,
            negativeItems: d.negativeItems || prev.negativeItems,
            highestLimit: d.highestLimit || prev.highestLimit,
            inquiries: d.inquiries || prev.inquiries,
            personalInfo: d.personalInfo || prev.personalInfo,
            errors: d.errors || prev.errors,
          });
        });
        setUploadMode(false);
      } else {
        setError(data.error || "Could not extract data from file. Please enter manually.");
      }
    } catch (err) {
      setError("Upload failed. Please try again or enter manually.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email) {
      setError("First name, last name, and email are required");
      return;
    }
    setError("");
    setLoading(true);

    try {
      var res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: form,
          userId: user ? user.id : null,
          tenantId: tenant ? tenant.id : null,   // ← KEY FIX: pass tenant
        }),
      });

      var data = await res.json();
      if (data.success) {
        router.push("/analysis/" + data.id + "?new=1");
      } else {
        setError(data.error || "Analysis failed. Please try again.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ maxWidth: "560px", margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/dashboard" style={{ color: "var(--text-muted)", fontSize: "13px", textDecoration: "none" }}>
            ← Dashboard
          </Link>
          {/* GHL sync indicator */}
          {tenant && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 10px", borderRadius: "20px",
              background: tenant.ghl_enabled ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.05)",
              border: "1px solid " + (tenant.ghl_enabled ? "rgba(57,255,20,0.3)" : "var(--border)"),
            }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: tenant.ghl_enabled ? "var(--brand)" : "var(--text-dim)",
              }} />
              <span style={{ fontSize: "11px", color: tenant.ghl_enabled ? "var(--brand)" : "var(--text-dim)" }}>
                {tenant.ghl_enabled ? "GHL Sync On" : "GHL Sync Off"}
              </span>
            </div>
          )}
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "16px 0 4px", color: "var(--text)" }}>
          New Credit Analysis
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          {tenant ? tenant.name : "Personal"} — Step {step} of {STEPS.length}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ maxWidth: "560px", margin: "0 auto 24px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {STEPS.map(function (s) {
            return (
              <div key={s.id} style={{
                flex: 1, height: "4px", borderRadius: "2px",
                background: step >= s.id ? "var(--brand)" : "var(--border)",
                transition: "background 0.3s",
              }} />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
          {STEPS.map(function (s) {
            return (
              <span key={s.id} style={{ fontSize: "11px", color: step >= s.id ? "var(--brand)" : "var(--text-dim)" }}>
                {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Form card */}
      <div style={{
        maxWidth: "560px", margin: "0 auto",
        background: "var(--bg-card)", borderRadius: "16px",
        border: "1px solid var(--border)", padding: "28px 24px",
      }}>
        {/* PDF Upload toggle (step 1 only) */}
        {step === 1 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <button onClick={function () { setUploadMode(false); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px",
                  fontWeight: "600", cursor: "pointer", border: "1.5px solid",
                  borderColor: !uploadMode ? "var(--brand)" : "var(--border)",
                  background: !uploadMode ? "rgba(57,255,20,0.1)" : "transparent",
                  color: !uploadMode ? "var(--brand)" : "var(--text-muted)",
                }}>
                Manual Entry
              </button>
              <button onClick={function () { setUploadMode(true); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px",
                  fontWeight: "600", cursor: "pointer", border: "1.5px solid",
                  borderColor: uploadMode ? "var(--brand)" : "var(--border)",
                  background: uploadMode ? "rgba(57,255,20,0.1)" : "transparent",
                  color: uploadMode ? "var(--brand)" : "var(--text-muted)",
                }}>
                Upload PDF
              </button>
            </div>

            {uploadMode && (
              <div style={{
                border: "2px dashed var(--border)", borderRadius: "12px",
                padding: "32px 24px", textAlign: "center",
              }}>
                {uploading ? (
                  <div>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Extracting data from PDF...</p>
                  </div>
                ) : uploadFile ? (
                  <div>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
                    <p style={{ fontSize: "13px", color: "var(--brand)", margin: "0 0 4px" }}>{uploadFile.name}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Data extracted — review and edit below</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
                    <p style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 4px", color: "var(--text)" }}>
                      Upload Credit Report
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 16px" }}>
                      PDF or image — we'll extract the scores automatically
                    </p>
                    <label style={{
                      display: "inline-block", padding: "10px 20px",
                      background: "var(--brand)", color: "#000", borderRadius: "8px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer",
                    }}>
                      Choose File
                      <input type="file" accept=".pdf,image/*" onChange={handleUpload}
                        style={{ display: "none" }} />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Credit Scores */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>
              Bureau Scores
            </h2>
            <Field label="TransUnion Score" value={form.scoreTU}
              onChange={function (v) { update("scoreTU", v); }}
              placeholder="e.g. 680" type="number" />
            <Field label="Experian Score" value={form.scoreEX}
              onChange={function (v) { update("scoreEX", v); }}
              placeholder="e.g. 695" type="number" />
            <Field label="Equifax Score" value={form.scoreEQ}
              onChange={function (v) { update("scoreEQ", v); }}
              placeholder="e.g. 672" type="number" />
          </div>
        )}

        {/* Step 2: Credit Profile */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>
              Credit Profile
            </h2>
            <Field label="Overall Utilization %" value={form.utilization}
              onChange={function (v) { update("utilization", v); }}
              placeholder="e.g. 28" type="number" />
            <Field label="Number of Primary Accounts" value={form.primaryAccounts}
              onChange={function (v) { update("primaryAccounts", v); }}
              placeholder="e.g. 4" type="number" />
            <Field label="Average Credit Age (years)" value={form.creditAge}
              onChange={function (v) { update("creditAge", v); }}
              placeholder="e.g. 3.5" type="number" />
            <Field label="Late Payments (last 24 months)" value={form.latePayments}
              onChange={function (v) { update("latePayments", v); }}
              placeholder="0" type="number" />
            <Field label="Negative Items" value={form.negativeItems}
              onChange={function (v) { update("negativeItems", v); }}
              placeholder="0" type="number" />
            <Field label="Highest Card Limit ($)" value={form.highestLimit}
              onChange={function (v) { update("highestLimit", v); }}
              placeholder="e.g. 5000" type="number" />
            <Field label="Inquiries per Bureau" value={form.inquiries}
              onChange={function (v) { update("inquiries", v); }}
              placeholder="e.g. 2" type="number" />
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
                Personal Info Correct on All Bureaus?
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["yes", "no"].map(function (opt) {
                  return (
                    <button key={opt} onClick={function () { update("personalInfo", opt); }}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px",
                        fontWeight: "600", cursor: "pointer", border: "1.5px solid",
                        textTransform: "capitalize",
                        borderColor: form.personalInfo === opt ? "var(--brand)" : "var(--border)",
                        background: form.personalInfo === opt ? "rgba(57,255,20,0.1)" : "transparent",
                        color: form.personalInfo === opt ? "var(--brand)" : "var(--text-muted)",
                      }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
                Report Errors Present?
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["yes", "no"].map(function (opt) {
                  return (
                    <button key={opt} onClick={function () { update("errors", opt); }}
                      style={{
                        flex: 1, padding: "10px", borderRadius: "10px", fontSize: "13px",
                        fontWeight: "600", cursor: "pointer", border: "1.5px solid",
                        textTransform: "capitalize",
                        borderColor: form.errors === opt ? "var(--brand)" : "var(--border)",
                        background: form.errors === opt ? "rgba(57,255,20,0.1)" : "transparent",
                        color: form.errors === opt ? "var(--brand)" : "var(--text-muted)",
                      }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Contact Info */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>
              Client Contact Info
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="First Name" value={form.firstName}
                onChange={function (v) { update("firstName", v); }} placeholder="Marcus" />
              <Field label="Last Name" value={form.lastName}
                onChange={function (v) { update("lastName", v); }} placeholder="Johnson" />
            </div>
            <Field label="Email" value={form.email}
              onChange={function (v) { update("email", v); }}
              placeholder="marcus@email.com" type="email" />
            <Field label="Phone" value={form.phone}
              onChange={function (v) { update("phone", v); }}
              placeholder="+1 (555) 000-0000" type="tel" />

            {/* GHL sync preview */}
            {tenant && tenant.ghl_enabled && (
              <div style={{
                marginTop: "8px", padding: "14px", borderRadius: "10px",
                background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)",
              }}>
                <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--brand)", margin: "0 0 4px" }}>
                  ✓ GHL Sync Active
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                  After analysis, this contact will be created/updated in {tenant.name}'s GHL account with credit scores, funding readiness, and tags.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: "16px", padding: "12px 14px", borderRadius: "10px",
            background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)",
            color: "var(--danger)", fontSize: "13px",
          }}>
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          {step > 1 && (
            <button onClick={prevStep}
              style={{
                flex: 1, padding: "14px", borderRadius: "12px", fontSize: "14px",
                fontWeight: "600", cursor: "pointer",
                background: "transparent", border: "1.5px solid var(--border)",
                color: "var(--text-muted)",
              }}>
              Back
            </button>
          )}
          {step < STEPS.length ? (
            <button onClick={nextStep}
              style={{
                flex: 1, padding: "14px", borderRadius: "12px", fontSize: "14px",
                fontWeight: "700", cursor: "pointer",
                background: "var(--brand)", border: "none", color: "#000",
              }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              style={{
                flex: 1, padding: "14px", borderRadius: "12px", fontSize: "14px",
                fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "var(--border)" : "var(--brand)",
                border: "none", color: loading ? "var(--text-muted)" : "#000",
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? "Running Analysis..." : "Run AI Analysis →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "var(--text-muted)" }}>
        {label}
      </label>
      <input
        type={type || "text"}
        value={value}
        onChange={function (e) { onChange(e.target.value); }}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: "10px",
          background: "var(--bg)", border: "1.5px solid var(--border)",
          color: "var(--text)", fontSize: "14px", outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={function (e) { e.target.style.borderColor = "var(--brand)"; }}
        onBlur={function (e) { e.target.style.borderColor = "var(--border)"; }}
      />
    </div>
  );
}
