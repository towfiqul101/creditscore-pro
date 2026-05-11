"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  var [user, setUser] = useState(null);
  var [analyses, setAnalyses] = useState([]);
  var [stats, setStats] = useState({ total: 0, avgScore: 0, fundingReady: 0, thisMonth: 0 });
  var [loading, setLoading] = useState(true);
  var [deleting, setDeleting] = useState(null);
  var router = useRouter();
  var supabase = createClient();

  useEffect(function() {
    loadData();
  }, []);

  async function loadData() {
    var result = await supabase.auth.getUser();
    var u = result.data.user;
    if (!u) { router.push("/login"); return; }
    setUser(u);

    var response = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    var list = response.data || [];
    setAnalyses(list);

    var now = new Date();
    var thisMonth = list.filter(function(a) {
      return new Date(a.created_at).getMonth() === now.getMonth();
    });
    var totalScore = 0;
    for (var i = 0; i < list.length; i++) {
      totalScore += (list[i].funding_score || 0);
    }
    setStats({
      total: list.length,
      avgScore: list.length > 0 ? Math.round(totalScore / list.length) : 0,
      fundingReady: list.filter(function(a) { return (a.funding_score || 0) >= 8; }).length,
      thisMonth: thisMonth.length,
    });
    setLoading(false);
  }

  async function handleDelete(id, name) {
    var confirmed = window.confirm("Delete analysis for " + name + "? This cannot be undone.");
    if (!confirmed) return;
    setDeleting(id);
    var response = await supabase.from("analyses").delete().eq("id", id);
    if (response.error) {
      alert("Delete failed: " + response.error.message);
      setDeleting(null);
      return;
    }
    var updated = analyses.filter(function(a) { return a.id !== id; });
    setAnalyses(updated);
    var now = new Date();
    var thisMonth = updated.filter(function(a) {
      return new Date(a.created_at).getMonth() === now.getMonth();
    });
    var totalScore = 0;
    for (var i = 0; i < updated.length; i++) {
      totalScore += (updated[i].funding_score || 0);
    }
    setStats({
      total: updated.length,
      avgScore: updated.length > 0 ? Math.round(totalScore / updated.length) : 0,
      fundingReady: updated.filter(function(a) { return (a.funding_score || 0) >= 8; }).length,
      thisMonth: thisMonth.length,
    });
    setDeleting(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
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
          <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/analysis/new" className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--brand)", color: "#000" }}>
            + New analysis
          </Link>
          <button onClick={handleLogout} className="text-xs" style={{ color: "var(--text-muted)" }}>Sign out</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">
            {"Welcome back" + (user && user.user_metadata && user.user_metadata.full_name ? ", " + user.user_metadata.full_name.split(" ")[0] : "")}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Here's your credit analysis overview.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            ["Total analyses", stats.total, null],
            ["This month", stats.thisMonth, null],
            ["Avg score", stats.avgScore + "/10", stats.avgScore >= 7 ? "var(--brand)" : stats.avgScore >= 5 ? "var(--warning)" : "var(--danger)"],
            ["Funding ready", stats.fundingReady, "var(--brand)"],
          ].map(function(item) {
            var label = item[0];
            var value = item[1];
            var color = item[2];
            return (
              <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-xl font-semibold" style={{ color: color || "var(--text)" }}>{value}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-medium">Recent analyses</p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>{stats.total + " total"}</p>
          </div>

          {analyses.length === 0 ? (
            <div className="px-4 py-12 text-center" style={{ background: "var(--surface)" }}>
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>No analyses yet</p>
              <Link href="/analysis/new" className="text-sm" style={{ color: "var(--brand)" }}>Run your first analysis</Link>
            </div>
          ) : (
            <div style={{ background: "var(--surface)" }}>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs" style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>
                <span className="col-span-3">Client</span>
                <span className="col-span-1">Score</span>
                <span className="col-span-2">FICO Avg</span>
                <span className="col-span-2">Funding</span>
                <span className="col-span-2">Date</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>
              {analyses.map(function(a) {
                var clientName = (a.contact_first_name || "") + " " + (a.contact_last_name || "");
                var scoreColor = (a.funding_score || 0) >= 7 ? "var(--brand)" : (a.funding_score || 0) >= 5 ? "var(--warning)" : "var(--danger)";
                var dateStr = new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                var isDeleting = deleting === a.id;
                return (
                  <div key={a.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
                    style={{ borderBottom: "1px solid var(--border)", opacity: isDeleting ? 0.5 : 1 }}>
                    <div className="col-span-3">
                      <p className="text-sm font-medium truncate">{clientName}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{a.contact_email}</p>
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm font-semibold" style={{ color: scoreColor }}>
                        {(a.funding_score || 0) + "/10"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm">{a.score_avg || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.estimated_funding || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{dateStr}</span>
                    </div>
                    <div className="col-span-2 flex gap-2 justify-end">
                      <Link href={"/analysis/" + a.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: "rgba(57,255,20,0.1)", color: "var(--brand)", textDecoration: "none" }}>
                        View
                      </Link>
                      <button
                        onClick={function(e) { e.stopPropagation(); handleDelete(a.id, clientName); }}
                        disabled={isDeleting}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)" }}>
                        {isDeleting ? "..." : "Delete"}
                      </button>
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
