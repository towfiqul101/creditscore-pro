"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function AnalysisDetail() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCriteria, setExpandedCriteria] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data, error: fetchError } = await supabase
          .from("analyses")
          .select("*")
          .eq("id", params.id)
          .single();

        if (fetchError || !data) {
          setError("Analysis not found: " + (fetchError?.message || "No data"));
          setLoading(false);
          return;
        }
        setAnalysis(data);
        setLoading(false);
      } catch (err) {
        setError("Error loading: " + err.message);
        setLoading(false);
      }
    }
    if (params.id) load();
  }, [params.id]);

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const { generatePDFReport } = await import("@/lib/pdf-report");
      const doc = generatePDFReport({
        analysis: {
          score: analysis.funding_score,
          percentage: analysis.funding_percentage,
          avgScore: analysis.score_avg,
          estimatedFunding: analysis.estimated_funding,
          bureauScores: {
            TransUnion: analysis.score_tu,
            Experian: analysis.score_ex,
            Equifax: analysis.score_eq,
          },
          results: analysis.results || [],
        },
        contactInfo: {
          firstName: analysis.contact_first_name,
          lastName: analysis.contact_last_name,
        },
      });
      doc.save("CreditScore-Pro-" + analysis.contact_first_name + "-" + analysis.contact_last_name + ".pdf");
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center">
        <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>
        <Link href="/dashboard" className="text-sm" style={{ color: "var(--brand)" }}>Back to dashboard</Link>
      </div>
    </div>
  );

  const results = analysis.results || [];
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const pct = analysis.funding_percentage || 0;

  var circumference = 2 * Math.PI * 52;
  var offset = circumference - (pct / 100) * circumference;
  var scoreColor = pct >= 80 ? "var(--brand)" : pct >= 50 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(57,255,20,0.12)", color: "var(--brand)" }}>CS</div>
          <span className="text-sm font-semibold">CreditScore Pro</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={handleDownloadPDF} disabled={downloadingPDF}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {downloadingPDF ? "Generating..." : "Download PDF"}
          </button>
          <Link href="/analysis/new" className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--brand)", color: "#000" }}>
            + New analysis
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6 animate-fade-up">
          <h1 className="text-xl font-semibold">
            {analysis.contact_first_name} {analysis.contact_last_name}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {analysis.contact_email} · Analyzed {new Date(analysis.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="rounded-2xl p-6 mb-4 animate-fade-up" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor} strokeWidth="6"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: scoreColor }}>{analysis.funding_score}</span>
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>of 10</span>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Bureau scores</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["TransUnion", analysis.score_tu],
                  ["Experian", analysis.score_ex],
                  ["Equifax", analysis.score_eq],
                ].map(function(item) {
                  var name = item[0];
                  var score = item[1];
                  var c = score >= 700 ? "var(--brand)" : score >= 650 ? "var(--warning)" : "var(--danger)";
                  return (
                    <div key={name} className="rounded-xl p-3 text-center" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{name}</p>
                      <p className="text-xl font-bold" style={{ color: c }}>{score || "—"}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-xl p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>FICO Avg</p>
                  <p className="text-lg font-bold">{analysis.score_avg || "—"}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Est. Funding</p>
                  <p className="text-lg font-bold" style={{ color: "var(--brand)" }}>{analysis.estimated_funding || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {analysis.summary && (
          <div className="rounded-2xl p-5 mb-4 animate-fade-up" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand)" }}>AI Summary</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{analysis.summary}</p>
          </div>
        )}

        {analysis.priority_actions && analysis.priority_actions.length > 0 && (
          <div className="rounded-2xl p-5 mb-4 animate-fade-up" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--warning)" }}>Priority actions</p>
            <div className="space-y-2">
              {analysis.priority_actions.map(function(action, i) {
                return (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg shrink-0"
                      style={{ background: "rgba(255,184,0,0.12)", color: "var(--warning)" }}>{i + 1}</span>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{action}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">10-point funding readiness</p>
            <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--brand)" }}>{passed} passed</span>
              <span style={{ color: "var(--danger)" }}>{failed} needs work</span>
            </div>
          </div>

          <div className="space-y-2">
            {results.map(function(r, idx) {
              var isExpanded = expandedCriteria === idx;
              var color = r.passed ? "var(--brand)" : "var(--danger)";
              var labels = ["700+ FICO 8", "Personal Info", "Clean Report", "Utilization <30%", "4+ Primary Accts", "Credit Age 2+", "No Late Payments", "No Negatives", "$10K+ Card", "Max 2 Inquiries"];
              return (
                <div key={idx} className="rounded-xl overflow-hidden transition-all"
                  style={{ background: "var(--surface)", border: "1px solid " + (isExpanded ? (r.passed ? "rgba(57,255,20,0.3)" : "rgba(255,68,68,0.3)") : "var(--border)") }}>
                  <button onClick={function() { setExpandedCriteria(isExpanded ? null : idx); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left">
                    <span className="text-xs font-bold w-6 text-center" style={{ color: color }}>
                      {String(r.criteriaId).padStart(2, "0")}
                    </span>
                    <span className="text-sm flex-1 font-medium">{labels[idx] || ("Criteria " + (idx + 1))}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                      style={{ background: r.passed ? "rgba(15,175,60,0.12)" : "rgba(255,68,68,0.12)", color: color }}>
                      {r.passed ? "PASS" : "FAIL"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>{r.value}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 animate-slide-down" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="pt-3 space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: "var(--text-muted)" }}>{r.rating}</span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: r.passed ? "100%" : r.rating === "Fair" ? "50%" : "25%",
                              background: color,
                            }} />
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.explanation}</p>

                        {r.aiInsight && (
                          <div className="rounded-lg p-3" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.1)" }}>
                            <p className="text-xs" style={{ color: "var(--brand)" }}>{r.aiInsight}</p>
                          </div>
                        )}

                        <div className="rounded-lg p-3" style={{ background: "var(--bg)" }}>
                          <p className="text-xs font-medium mb-1" style={{ color: r.passed ? "var(--brand)" : "var(--warning)" }}>
                            {r.passed ? "Maintain" : "Action needed"}
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.action}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleDownloadPDF} disabled={downloadingPDF}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {downloadingPDF ? "Generating..." : "Download PDF report"}
          </button>
          <Link href="/analysis/new"
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-center transition-all"
            style={{ background: "var(--brand)", color: "#000", textDecoration: "none" }}>
            Run another analysis
          </Link>
        </div>
      </div>
    </div>
  );
}
