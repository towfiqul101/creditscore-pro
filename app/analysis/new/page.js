"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

var STEPS = [
  { id: 1, label: "Client Info" },
  { id: 2, label: "Bureau Scores" },
  { id: 3, label: "Credit Profile" },
  { id: 4, label: "Negative Factors" },
];

export default function NewAnalysis() {
  var [user, setUser] = useState(null);
  var [step, setStep] = useState(1);
  var [loading, setLoading] = useState(false);
  var [uploading, setUploading] = useState(false);
  var [error, setError] = useState("");
  var [inputMode, setInputMode] = useState("form");
  var fileRef = useRef(null);
  var router = useRouter();
  var supabase = createClient();

  var [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    scoreTU: "", scoreEX: "", scoreEQ: "",
    personalInfo: "yes", errors: "0",
    utilization: "", primaryAccounts: "", creditAge: "",
    latePayments: "0", negativeItems: "0", highestLimit: "", inquiries: "",
  });

  useEffect(function() {
    async function checkAuth() {
      var result = await supabase.auth.getUser();
      var u = result.data.user;
      if (!u) router.push("/login");
      else setUser(u);
    }
    checkAuth();
  }, []);

  function update(field, val) {
    setForm(function(prev) { return Object.assign({}, prev, { [field]: val }); });
  }

  async function handleUpload(e) {
    var file = e.target.files ? e.target.files[0] : null;
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      var fd = new FormData();
      fd.append("file", file);
      var res = await fetch("/api/upload", { method: "POST", body: fd });
      var data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");
      var d = data.extractedData;
      setForm({
        firstName: d.firstName || "", lastName: d.lastName || "",
        email: form.email, phone: form.phone,
        scoreTU: String(d.scoreTU || ""), scoreEX: String(d.scoreEX || ""), scoreEQ: String(d.scoreEQ || ""),
        personalInfo: d.personalInfo || "yes", errors: String(d.errors || "0"),
        utilization: String(d.utilization || ""), primaryAccounts: String(d.primaryAccounts || ""),
        creditAge: String(d.creditAge || ""), latePayments: String(d.latePayments || "0"),
        negativeItems: String(d.negativeItems || "0"), highestLimit: String(d.highestLimit || ""),
        inquiries: String(d.inquiries || ""),
      });
      setInputMode("form");
      setStep(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      var res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: form, userId: user ? user.id : null }),
      });
      var data = await res.json();
      if (!data.success) throw new Error(data.error || "Analysis failed");
      if (data.id) {
        router.push("/analysis/" + data.id);
      } else {
        var score = data.analysis ? data.analysis.score : "?";
        var dbErr = data.dbError || "unknown";
        alert("Analysis complete! Score: " + score + "/10. DB error: " + dbErr);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function canNext() {
    if (step === 1) return form.firstName && form.lastName && form.email;
    if (step === 2) return form.scoreTU && form.scoreEX && form.scoreEQ;
    if (step === 3) return form.utilization && form.primaryAccounts && form.creditAge && form.highestLimit && form.inquiries;
    return true;
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center animate-fade-up">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 animate-spin" style={{ borderColor: "transparent", borderTopColor: "var(--brand)" }} />
          <div className="absolute inset-3 rounded-full border-2 animate-spin" style={{ borderColor: "transparent", borderBottomColor: "var(--brand-dark)", animationDirection: "reverse", animationDuration: "1.5s" }} />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: "var(--brand)" }}>AI</div>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--brand)" }}>Analyzing credit profile</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Scoring 10 funding criteria with AI...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(57,255,20,0.12)", color: "var(--brand)" }}>CS</div>
          <span className="text-sm font-semibold">CreditScore Pro</span>
        </Link>
        <Link href="/dashboard" className="text-xs" style={{ color: "var(--text-muted)" }}>Back to dashboard</Link>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <button onClick={function() { setInputMode("form"); }}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: inputMode === "form" ? "rgba(57,255,20,0.12)" : "transparent", color: inputMode === "form" ? "var(--brand)" : "var(--text-muted)" }}>
            Manual entry
          </button>
          <button onClick={function() { setInputMode("upload"); }}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: inputMode === "upload" ? "rgba(57,255,20,0.12)" : "transparent", color: inputMode === "upload" ? "var(--brand)" : "var(--text-muted)" }}>
            Upload report (PDF)
          </button>
        </div>

        {inputMode === "upload" && (
          <div className="animate-fade-up">
            <div className="rounded-2xl p-8 text-center cursor-pointer transition-all hover:opacity-90"
              style={{ background: "var(--surface)", border: "2px dashed var(--border-light)" }}
              onClick={function() { if (fileRef.current) fileRef.current.click(); }}>
              <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleUpload} className="hidden" />
              {uploading ? (
                <div>
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--brand)" }}>Parsing with AI...</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Extracting credit data from your report</p>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-3">📄</div>
                  <p className="text-sm font-medium mb-1">Upload your trimerge credit report</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>PDF or image, up to 20MB. AI will extract all data automatically.</p>
                </div>
              )}
            </div>
            {error && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>{error}</p>}
            <p className="text-xs text-center mt-4" style={{ color: "var(--text-dim)" }}>
              Works with SmartCredit, IdentityIQ, and most trimerge formats
            </p>
          </div>
        )}

        {inputMode === "form" && (
          <div className="animate-fade-up">
            <div className="flex items-center gap-1 mb-6">
              {STEPS.map(function(s) {
                return (
                  <div key={s.id} className="flex items-center gap-1 flex-1">
                    <div className="h-1.5 flex-1 rounded-full transition-all"
                      style={{ background: step >= s.id ? "var(--brand)" : "var(--border)" }} />
                  </div>
                );
              })}
            </div>
            <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
              {"Step " + step + " of 4 · "}<span className="font-medium" style={{ color: "var(--text)" }}>{STEPS[step - 1].label}</span>
            </p>

            {step === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" value={form.firstName} onChange={function(v) { update("firstName", v); }} placeholder="John" />
                  <Field label="Last name" value={form.lastName} onChange={function(v) { update("lastName", v); }} placeholder="Doe" />
                </div>
                <Field label="Email" type="email" value={form.email} onChange={function(v) { update("email", v); }} placeholder="john@email.com" />
                <Field label="Phone (optional)" type="tel" value={form.phone} onChange={function(v) { update("phone", v); }} placeholder="(555) 123-4567" />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>Enter your FICO 8 scores from each bureau</p>
                <Field label="TransUnion" type="number" value={form.scoreTU} onChange={function(v) { update("scoreTU", v); }} placeholder="720" />
                <Field label="Experian" type="number" value={form.scoreEX} onChange={function(v) { update("scoreEX", v); }} placeholder="715" />
                <Field label="Equifax" type="number" value={form.scoreEQ} onChange={function(v) { update("scoreEQ", v); }} placeholder="710" />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Field label="Highest utilization on any card (%)" type="number" value={form.utilization} onChange={function(v) { update("utilization", v); }} placeholder="25" />
                <Field label="Number of open primary accounts" type="number" value={form.primaryAccounts} onChange={function(v) { update("primaryAccounts", v); }} placeholder="5" />
                <Field label="Average credit age (years)" type="number" value={form.creditAge} onChange={function(v) { update("creditAge", v); }} placeholder="3" />
                <Field label="Highest card limit ($)" type="number" value={form.highestLimit} onChange={function(v) { update("highestLimit", v); }} placeholder="15000" />
                <Field label="Hard inquiries per bureau (last 24 mo)" type="number" value={form.inquiries} onChange={function(v) { update("inquiries", v); }} placeholder="2" />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Is personal info correct across all bureaus?</label>
                  <div className="flex gap-2">
                    {["yes", "no"].map(function(v) {
                      return (
                        <button key={v} onClick={function() { update("personalInfo", v); }}
                          className="flex-1 py-3 rounded-xl text-sm font-medium transition-all capitalize"
                          style={{
                            background: form.personalInfo === v ? "rgba(57,255,20,0.12)" : "var(--surface)",
                            border: "1.5px solid " + (form.personalInfo === v ? "var(--brand)" : "var(--border)"),
                            color: form.personalInfo === v ? "var(--brand)" : "var(--text-muted)",
                          }}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="Reporting errors found" type="number" value={form.errors} onChange={function(v) { update("errors", v); }} placeholder="0" />
                <Field label="Late payments in last 24 months" type="number" value={form.latePayments} onChange={function(v) { update("latePayments", v); }} placeholder="0" />
                <Field label="Negative items (collections, charge-offs, etc.)" type="number" value={form.negativeItems} onChange={function(v) { update("negativeItems", v); }} placeholder="0" />
              </div>
            )}

            {error && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>{error}</p>}

            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <button onClick={function() { setStep(function(s) { return s - 1; }); }}
                  className="px-5 py-3 rounded-xl text-sm font-medium"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  Back
                </button>
              )}
              {step < 4 ? (
                <button onClick={function() { if (canNext()) setStep(function(s) { return s + 1; }); }} disabled={!canNext()}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: canNext() ? "var(--brand)" : "var(--border)", color: canNext() ? "#000" : "var(--text-dim)" }}>
                  Continue
                </button>
              ) : (
                <button onClick={handleSubmit}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "var(--brand)", color: "#000", boxShadow: "0 0 20px rgba(57,255,20,0.2)" }}>
                  Run AI analysis
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field(props) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{props.label}</label>
      <input
        type={props.type || "text"} value={props.value} onChange={function(e) { props.onChange(e.target.value); }}
        placeholder={props.placeholder}
        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-colors"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)" }}
        onFocus={function(e) { e.target.style.borderColor = "var(--brand)"; }}
        onBlur={function(e) { e.target.style.borderColor = "var(--border)"; }}
      />
    </div>
  );
}
