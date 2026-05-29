"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";

export default function PublicResultsPage() {
  var [analysis, setAnalysis] = useState(null);
  var [tenant, setTenant] = useState(null);
  var [loading, setLoading] = useState(true);
  var [notFound, setNotFound] = useState(false);
  var [expandedCriteria, setExpandedCriteria] = useState(null);
  var [downloadingPDF, setDownloadingPDF] = useState(false);
  var params = useParams();

  useEffect(function() {
    async function load() {
      var supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      var res = await supabase.from("analyses").select("*").eq("id", params.id).single();
      if (res.error || !res.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      var data = res.data;
      setAnalysis(data);

      if (data.tenant_id) {
        var tenantRes = await supabase
          .from("tenants")
          .select("brand_name, brand_color, logo_url")
          .eq("id", data.tenant_id)
          .single();
        if (!tenantRes.error && tenantRes.data) {
          setTenant(tenantRes.data);
        }
      }

      setLoading(false);
    }

    if (params.id) load();
  }, [params.id]);

  async function handleDownloadPDF() {
    setDownloadingPDF(true);
    try {
      var { generatePDFReport } = await import("@/lib/pdf-report");
      var brandColor = tenant && tenant.brand_color ? tenant.brand_color : null;
      var brandName = tenant && tenant.brand_name ? tenant.brand_name : null;
      var doc = generatePDFReport({
        analysis: {
          score: analysis.funding_score,
          percentage: analysis.funding_percentage,
          avgScore: analysis.score_avg,
          estimatedFunding: analysis.estimated_funding,
          bureauScores: [analysis.score_tu, analysis.score_ex, analysis.score_eq],
          results: analysis.results || [],
          summary: analysis.summary,
          priorityActions: analysis.priority_actions || [],
        },
        contactInfo: {
          firstName: analysis.contact_first_name,
          lastName: analysis.contact_last_name,
          email: analysis.contact_email,
        },
        brandName: brandName,
        brandColor: brandColor,
      });
      var firstName = analysis.contact_first_name || "Client";
      doc.save((brandName || "CreditScore-Pro") + "-" + firstName + ".pdf");
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setDownloadingPDF(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #222", borderTopColor: "#39FF14", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center", maxWidth: "420px", padding: "0 24px" }}>
          <p style={{ fontSize: "16px", color: "#888", marginBottom: "16px", lineHeight: 1.6 }}>
            Results not found. This link may have expired or been removed.
          </p>
          <a href="/" style={{ fontSize: "14px", color: "#39FF14", textDecoration: "none" }}>
            ← Go to CreditScore Pro
          </a>
        </div>
      </div>
    );
  }

  var brandColor = (tenant && tenant.brand_color) || "#39FF14";
  var brandName = (tenant && tenant.brand_name) || "CreditScore Pro";
  var logoUrl = tenant && tenant.logo_url;

  var results = analysis.results || [];
  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;
  var pct = analysis.funding_percentage || 0;
  var circumference = 2 * Math.PI * 52;
  var offset = circumference - (pct / 100) * circumference;
  var scoreColor = pct >= 80 ? "var(--page-brand)" : pct >= 50 ? "#FFB800" : "#FF4444";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", "--page-brand": brandColor }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: "56px",
        background: "#0a0a0a", borderBottom: "1px solid #1e1e1e",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brandName}
              style={{ height: "40px", maxWidth: "160px", objectFit: "contain" }}
              onError={function(e) { e.target.style.display = "none"; }}
            />
          ) : (
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: brandColor + "22",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: "700", color: brandColor, flexShrink: 0,
            }}>CS</div>
          )}
          <span style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>{brandName}</span>
        </div>
        <a href="/" style={{
          padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
          background: brandColor, color: "#000", textDecoration: "none", whiteSpace: "nowrap",
        }}>
          Get your own analysis →
        </a>
      </header>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Client name + date */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#fff", margin: "0 0 4px" }}>
            {analysis.contact_first_name} {analysis.contact_last_name}
          </h1>
          <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>
            Analyzed {new Date(analysis.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Score card */}
        <div style={{ borderRadius: "16px", padding: "24px", marginBottom: "16px", background: "#111", border: "1px solid #1e1e1e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
              <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#1e1e1e" strokeWidth="6" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor} strokeWidth="6"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "2rem", fontWeight: "700", color: scoreColor, lineHeight: 1 }}>{analysis.funding_score}</span>
                <span style={{ fontSize: "11px", color: "#444" }}>of 10</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: "200px" }}>
              <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "12px", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bureau Scores</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {[
                  ["TransUnion", analysis.score_tu],
                  ["Experian", analysis.score_ex],
                  ["Equifax", analysis.score_eq],
                ].map(function(item) {
                  var bname = item[0];
                  var bscore = item[1];
                  var c = bscore >= 700 ? "var(--page-brand)" : bscore >= 650 ? "#FFB800" : "#FF4444";
                  return (
                    <div key={bname} style={{ borderRadius: "10px", padding: "10px 8px", textAlign: "center", background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                      <p style={{ fontSize: "10px", marginBottom: "4px", color: "#555", margin: "0 0 4px" }}>{bname}</p>
                      <p style={{ fontSize: "18px", fontWeight: "700", color: c, margin: 0 }}>{bscore || "—"}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                <div style={{ borderRadius: "10px", padding: "10px", background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <p style={{ fontSize: "10px", color: "#555", margin: "0 0 2px" }}>FICO Avg</p>
                  <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>{analysis.score_avg || "—"}</p>
                </div>
                <div style={{ borderRadius: "10px", padding: "10px", background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <p style={{ fontSize: "10px", color: "#555", margin: "0 0 2px" }}>Est. Funding</p>
                  <p style={{ fontSize: "16px", fontWeight: "700", color: "var(--page-brand)", margin: 0 }}>{analysis.estimated_funding || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {analysis.summary && (
          <div style={{ borderRadius: "14px", padding: "18px", marginBottom: "16px", background: brandColor + "08", border: "1px solid " + brandColor + "28" }}>
            <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "8px", color: "var(--page-brand)", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Summary</p>
            <p style={{ fontSize: "14px", lineHeight: 1.65, color: "#999", margin: 0 }}>{analysis.summary}</p>
          </div>
        )}

        {/* Priority Actions */}
        {analysis.priority_actions && analysis.priority_actions.length > 0 && (
          <div style={{ borderRadius: "14px", padding: "18px", marginBottom: "16px", background: "#111", border: "1px solid #1e1e1e" }}>
            <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "12px", color: "#FFB800", textTransform: "uppercase", letterSpacing: "0.05em" }}>Priority Actions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {analysis.priority_actions.map(function(action, i) {
                return (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", flexShrink: 0, background: "rgba(255,184,0,0.12)", color: "#FFB800" }}>{i + 1}</span>
                    <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#999", margin: 0 }}>{action}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 10-criteria list */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#fff", margin: 0 }}>10-Point Funding Readiness</p>
            <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
              <span style={{ color: "var(--page-brand)" }}>{passed} passed</span>
              <span style={{ color: "#FF4444" }}>{failed} needs work</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {results.map(function(r, idx) {
              var isExpanded = expandedCriteria === idx;
              var color = r.passed ? "var(--page-brand)" : "#FF4444";
              var labels = ["700+ FICO 8", "Personal Info", "Clean Report", "Utilization <30%", "4+ Primary Accts", "Credit Age 2+", "No Late Payments", "No Negatives", "$10K+ Card", "Max 2 Inquiries"];
              return (
                <div key={idx} style={{
                  borderRadius: "12px", overflow: "hidden", background: "#111",
                  border: "1px solid " + (isExpanded
                    ? (r.passed ? "rgba(57,255,20,0.3)" : "rgba(255,68,68,0.3)")
                    : "#1e1e1e"),
                }}>
                  <button
                    onClick={function() { setExpandedCriteria(isExpanded ? null : idx); }}
                    style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", width: "24px", textAlign: "center", color: color, flexShrink: 0 }}>
                      {String(r.criteriaId || (idx + 1)).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: "14px", flex: 1, fontWeight: "500", color: "#e0e0e0" }}>{labels[idx] || ("Criteria " + (idx + 1))}</span>
                    <span style={{
                      fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px", flexShrink: 0,
                      background: r.passed ? "rgba(15,175,60,0.12)" : "rgba(255,68,68,0.12)", color: color,
                    }}>{r.passed ? "PASS" : "FAIL"}</span>
                    <span style={{ fontSize: "12px", color: "#444", flexShrink: 0 }}>{r.value}</span>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1e1e1e" }}>
                      <div style={{ paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                            <span style={{ color: "#555" }}>{r.rating}</span>
                          </div>
                          <div style={{ height: "4px", borderRadius: "2px", background: "#1e1e1e" }}>
                            <div style={{
                              height: "100%", borderRadius: "2px",
                              width: r.passed ? "100%" : r.rating === "Fair" ? "50%" : "25%",
                              background: color,
                            }} />
                          </div>
                        </div>
                        <p style={{ fontSize: "13px", lineHeight: 1.6, color: "#777", margin: 0 }}>{r.explanation}</p>
                        {r.aiNote && (
                          <div style={{ borderRadius: "8px", padding: "10px 12px", background: brandColor + "08", border: "1px solid " + brandColor + "20" }}>
                            <p style={{ fontSize: "12px", color: "var(--page-brand)", margin: 0 }}>{r.aiNote}</p>
                          </div>
                        )}
                        <div style={{ borderRadius: "8px", padding: "10px 12px", background: "#0a0a0a" }}>
                          <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: r.passed ? "var(--page-brand)" : "#FFB800" }}>
                            {r.passed ? "Maintain" : "Action needed"}
                          </p>
                          <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#777", margin: 0 }}>{r.action}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            style={{
              flex: 1, minWidth: "160px", padding: "14px", borderRadius: "12px",
              fontSize: "14px", fontWeight: "500",
              border: "1px solid #2a2a2a", color: "#888", background: "none",
              cursor: downloadingPDF ? "not-allowed" : "pointer",
            }}>
            {downloadingPDF ? "Generating..." : "Download PDF Report"}
          </button>
          <a href="/" style={{
            flex: 1, minWidth: "160px", padding: "14px", borderRadius: "12px",
            fontSize: "14px", fontWeight: "700",
            background: brandColor, color: "#000", textDecoration: "none", textAlign: "center",
          }}>
            Get your own analysis →
          </a>
        </div>

        {/* Powered-by footer */}
        <div style={{ textAlign: "center", paddingBottom: "32px" }}>
          <p style={{ fontSize: "11px", color: "#333", margin: 0 }}>
            Powered by{" "}
            <a href="/" style={{ color: "#444", textDecoration: "none" }}>CreditScore Pro</a>
          </p>
        </div>
      </div>
    </div>
  );
}
