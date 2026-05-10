import Link from "next/link";

const CRITERIA = [
  { id: 1, label: "700+ FICO 8 Score", impact: "High" },
  { id: 2, label: "Correct Personal Info", impact: "Medium" },
  { id: 3, label: "Clean Report (No Errors)", impact: "High" },
  { id: 4, label: "Utilization <30%", impact: "High" },
  { id: 5, label: "4+ Primary Accounts", impact: "Medium" },
  { id: 6, label: "Avg Credit Age 2+ Yrs", impact: "Medium" },
  { id: 7, label: "No Late Payments (24 Mo)", impact: "High" },
  { id: 8, label: "No Negative Items", impact: "High" },
  { id: 9, label: "One $10K+ Primary Card", impact: "Medium" },
  { id: 10, label: "Max 2 Inquiries/Bureau", impact: "Medium" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(57,255,20,0.1)", color: "var(--brand)" }}>CS</div>
          <span className="text-base font-semibold">CreditScore Pro</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm" style={{ color: "var(--text-muted)" }}>Sign in</Link>
          <Link href="/analysis/new" className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ border: "1px solid rgba(57,255,20,0.4)", color: "var(--brand)" }}>Start analysis</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-2xl mx-auto px-6 pt-20 pb-14 text-center animate-fade-up">
        <div className="inline-block px-4 py-1.5 rounded-full mb-6"
          style={{ background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.15)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--brand)" }}>AI-powered credit analysis</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5" style={{ letterSpacing: "-1px" }}>
          Know exactly where<br />you stand for{" "}
          <span style={{ color: "var(--brand)" }}>funding</span>
        </h1>
        <p className="text-base mb-9 max-w-lg mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Get an instant 10-point funding readiness score with a personalized roadmap.
          Upload your credit report or enter your details — results in under 60 seconds.
        </p>
        <Link href="/analysis/new"
          className="inline-block px-10 py-4 rounded-xl text-base font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: "var(--brand)", color: "#000", boxShadow: "0 0 24px rgba(57,255,20,0.3)" }}>
          Analyze my credit free
        </Link>
        <p className="text-xs mt-4" style={{ color: "var(--text-dim)" }}>
          No credit card required · Results in under 60 seconds
        </p>
      </div>

      {/* Features */}
      <div className="max-w-3xl mx-auto px-6 pb-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ["🎯", "10-point scoring", "Evaluated against the exact criteria lenders use for funding approval."],
            ["⚡", "Instant AI analysis", "Detailed results in under 60 seconds with personalized action steps."],
            ["🔒", "Private & secure", "End-to-end encrypted. Only you can see your analysis results."],
          ].map(([icon, title, desc], i) => (
            <div key={i} className="rounded-2xl p-5 transition-all hover:-translate-y-0.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-2xl mb-3">{icon}</div>
              <p className="text-sm font-semibold mb-1.5">{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 10 Criteria */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-center text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--brand)" }}>
          The 10 criteria
        </p>
        <p className="text-center text-xl font-semibold mb-7">What defines a funding-ready credit file</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {CRITERIA.map((c) => (
            <div key={c.id} className="rounded-xl p-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(57,255,20,0.1)", color: "var(--brand)" }}>
                  {String(c.id).padStart(2, "0")}
                </span>
                <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  {c.impact}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-lg mx-auto px-6 py-10">
        <p className="text-center text-xl font-semibold mb-7">How it works</p>
        {[
          ["01", "Enter your credit details", "Fill out a short form with your bureau scores, account details, and negative factors. Takes under 2 minutes."],
          ["02", "AI analyzes your profile", "Our engine evaluates your credit against all 10 funding criteria instantly."],
          ["03", "Get your roadmap", "See your funding readiness score with a clear, prioritized action plan."],
        ].map(([num, title, desc]) => (
          <div key={num} className="flex gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.15)", color: "var(--brand)" }}>
              {num}
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Final CTA */}
      <div className="text-center px-6 py-10">
        <p className="text-2xl font-semibold mb-3">Ready for clarity on your credit?</p>
        <p className="text-sm mb-7" style={{ color: "var(--text-muted)" }}>Get your free analysis in under 60 seconds.</p>
        <Link href="/analysis/new"
          className="inline-block px-10 py-4 rounded-xl text-base font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: "var(--brand)", color: "#000" }}>
          Get my free score now
        </Link>
      </div>

      {/* Footer */}
      <footer className="text-center px-6 py-6" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          CreditScore Pro by Karvonix.io · © 2026 All rights reserved
        </p>
      </footer>
    </div>
  );
}
