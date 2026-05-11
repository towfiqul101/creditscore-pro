"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STEPS = [
  { id: 1, label: "Client Info" },
  { id: 2, label: "Bureau Scores" },
  { id: 3, label: "Credit Profile" },
  { id: 4, label: "Negative Factors" },
];

export default function NewAnalysis() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [inputMode, setInputMode] = useState("form"); // form or upload
  const fileRef = useRef(null);
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    scoreTU: "", scoreEX: "", scoreEQ: "",
    personalInfo: "yes", errors: "0",
    utilization: "", primaryAccounts: "", creditAge: "",
    latePayments: "0", negativeItems: "0", highestLimit: "", inquiries: "",
  });

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/login");
      else setUser(user);
    }
    checkAuth();
  }, []);

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  // PDF upload handler
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Upload failed");

      // Populate form with extracted data
      const d = data.extractedData;
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
      setStep(1); // Let them review
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Submit analysis
  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: form, userId: user?.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Analysis failed");
      if (data.id) {
        router.push(`/analysis/${data.id}`);
      } else {
        // DB save failed but analysis worked - show results in alert
        alert(`Analysis complete! Score: ${data.analysis.score}/10. DB save error: ${data.dbError || "unknown"}. Check Vercel logs.`);
        setLoading(false);
      } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 1) return form.firstName && form.lastName && form.email;
    if (step === 2) return form.scoreTU && form.scoreEX && form.scoreEQ;
    if (step === 3) return form.utilization && form.primaryAccounts && form.creditAge && form.highestLimit && form.inquiries;
    return true;
  };

  // Loading screen
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
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(57,255,20,0.12)", color: "var(--brand)" }}>CS</div>
          <span className="text-sm font-semibold">CreditScore Pro</span>
        </Link>
        <Link href="/dashboard" className="text-xs" style={{ color: "var(--text-muted)" }}>← Back to dashboard</Link>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Input mode toggle */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <button onClick={() => setInputMode("form")}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: inputMode === "form" ? "rgba(57,255,20,0.12)" : "transparent", color: inputMode === "form" ? "var(--brand)" : "var(--text-muted)" }}>
            Manual entry
          </button>
          <button onClick={() => setInputMode("upload")}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: inputMode === "upload" ? "rgba(57,255,20,0.12)" : "transparent", color: inputMode === "upload" ? "var(--brand)" : "var(--text-muted)" }}>
            Upload report (PDF)
          </button>
        </div>

        {/* Upload mode */}
        {inputMode === "upload" && (
          <div className="animate-fade-up">
            <div className="rounded-2xl p-8 text-center cursor-pointer transition-all hover:opacity-90"
              style={{ background: "var(--surface)", border: "2px dashed var(--border-light)" }}
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleUpload} className="hidden" />
              {uploading ? (
                <>
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--brand)" }}>Parsing with AI...</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Extracting credit data from your report</p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-3">📄</div>
                  <p className="text-sm font-medium mb-1">Upload your trimerge credit report</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>PDF or image, up to 20MB. AI will extract all data automatically.</p>
                </>
              )}
            </div>
            {error && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>{error}</p>}
            <p className="text-xs text-center mt-4" style={{ color: "var(--text-dim)" }}>
              Works with SmartCredit, IdentityIQ, and most trimerge formats
            </p>
          </div>
        )}

        {/* Form mode */}
        {inputMode === "form" && (
          <div className="animate-fade-up">
            {/* Step indicator */}
            <div className="flex items-center gap-1 mb-6">
              {STEPS.map((s) => (
                <div key={s.id} className="flex items-center gap-1 flex-1">
                  <div className="h-1.5 flex-1 rounded-full transition-all"
                    style={{ background: step >= s.id ? "var(--brand)" : "var(--border)" }} />
                </div>
              ))}
            </div>
            <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
              Step {step} of 4 · <span className="font-medium" style={{ color: "var(--text)" }}>{STEPS[step - 1].label}</span>
            </p>

            {/* Step 1: Client Info */}
            {step === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" value={form.firstName} onChange={v => update("firstName", v)} placeholder="John" />
                  <Field label="Last name" value={form.lastName} onChange={v => update("lastName", v)} placeholder="Doe" />
                </div>
                <Field label="Email" type="email" value={form.email} onChange={v => update("email", v)} placeholder="john@email.com" />
                <Field label="Phone (optional)" type="tel" value={form.phone} onChange={v => update("phone", v)} placeholder="(555) 123-4567" />
              </div>
            )}

            {/* Step 2: Bureau Scores */}
            {step === 2 && (
              <div className="space-y-3">
                <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>Enter your FICO 8 scores from each bureau</p>
                <Field label="TransUnion" type="number" value={form.scoreTU} onChange={v => update("scoreTU", v)} placeholder="720" min="300" max="850" />
                <Field label="Experian" type="number" value={form.scoreEX} onChange={v => update("scoreEX", v)} placeholder="715" min="300" max="850" />
                <Field label="Equifax" type="number" value={form.scoreEQ} onChange={v => update("scoreEQ", v)} placeholder="710" min="300" max="850" />
              </div>
            )}

            {/* Step 3: Credit Profile */}
            {step === 3 && (
              <div className="space-y-3">
                <Field label="Highest utilization on any card (%)" type="number" value={form.utilization} onChange={v => update("utilization", v)} placeholder="25" min="0" max="100" />
                <Field label="Number of open primary accounts" type="number" value={form.primaryAccounts} onChange={v => update("primaryAccounts", v)} placeholder="5" min="0" />
                <Field label="Average credit age (years)" type="number" value={form.creditAge} onChange={v => update("creditAge", v)} placeholder="3" min="0" step="0.5" />
                <Field label="Highest card limit ($)" type="number" value={form.highestLimit} onChange={v => update("highestLimit", v)} placeholder="15000" min="0" />
                <Field label="Hard inquiries per bureau (last 24 mo)" type="number" value={form.inquiries} onChange={v => update("inquiries", v)} placeholder="2" min="0" />
              </div>
            )}

            {/* Step 4: Negative Factors */}
            {step === 4 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Is personal info correct across all bureaus?</label>
                  <div className="flex gap-2">
                    {["yes", "no"].map(v => (
                      <button key={v} onClick={() => update("personalInfo", v)}
                        className="flex-1 py-3 rounded-xl text-sm font-medium transition-all capitalize"
                        style={{
                          background: form.personalInfo === v ? "rgba(57,255,20,0.12)" : "var(--surface)",
                          border: `1.5px solid ${form.personalInfo === v ? "var(--brand)" : "var(--border)"}`,
                          color: form.personalInfo === v ? "var(--brand)" : "var(--text-muted)",
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Reporting errors found" type="number" value={form.errors} onChange={v => update("errors", v)} placeholder="0" min="0" />
                <Field label="Late payments in last 24 months" type="number" value={form.latePayments} onChange={v => update("latePayments", v)} placeholder="0" min="0" />
                <Field label="Negative items (collections, charge-offs, etc.)" type="number" value={form.negativeItems} onChange={v => update("negativeItems", v)} placeholder="0" min="0" />
              </div>
            )}

            {/* Error */}
            {error && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>{error}</p>}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="px-5 py-3 rounded-xl text-sm font-medium"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  Back
                </button>
              )}
              {step < 4 ? (
                <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}
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

function Field({ label, value, onChange, type = "text", placeholder, min, max, step }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min} max={max} step={step}
        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-colors"
        style={{ background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)" }}
        onFocus={e => e.target.style.borderColor = "var(--brand)"}
        onBlur={e => e.target.style.borderColor = "var(--border)"}
      />
    </div>
  );
}
