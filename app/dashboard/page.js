"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, fundingReady: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: allAnalyses } = await supabase
        .from("analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const list = allAnalyses || [];
      setAnalyses(list);

      const now = new Date();
      const thisMonth = list.filter(a => new Date(a.created_at).getMonth() === now.getMonth());
      setStats({
        total: list.length,
        avgScore: list.length > 0 ? Math.round(list.reduce((s, a) => s + (a.funding_score || 0), 0) / list.length) : 0,
        fundingReady: list.filter(a => (a.funding_score || 0) >= 8).length,
        thisMonth: thisMonth.length,
      });
      setLoading(false);
    }
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--brand)" }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
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
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-1">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Here's your credit analysis overview.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            ["Total analyses", stats.total, null],
            ["This month", stats.thisMonth, null],
            ["Avg score", `${stats.avgScore}/10`, stats.avgScore >= 7 ? "var(--brand)" : stats.avgScore >= 5 ? "var(--warning)" : "var(--danger)"],
            ["Funding ready", stats.fundingReady, "var(--brand)"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-xl font-semibold" style={{ color: color || "var(--text)" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Analyses Table */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-medium">Recent analyses</p>
          </div>

          {analyses.length === 0 ? (
            <div className="px-4 py-12 text-center" style={{ background: "var(--surface)" }}>
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>No analyses yet</p>
              <Link href="/analysis/new" className="text-sm" style={{ color: "var(--brand)" }}>Run your first analysis →</Link>
            </div>
          ) : (
            <div style={{ background: "var(--surface)" }}>
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs" style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>
                <span className="col-span-3">Client</span>
                <span className="col-span-2">Score</span>
                <span className="col-span-2">FICO Avg</span>
                <span className="col-span-2">Funding</span>
                <span className="col-span-3">Date</span>
              </div>
              {/* Rows */}
              {analyses.map((a) => (
                <Link key={a.id} href={`/analysis/${a.id}`}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-black/20 cursor-pointer block"
                  style={{ borderBottom: "1px solid var(--border)", textDecoration: "none", color: "inherit" }}>
                  <div className="col-span-3">
                    <p className="text-sm font-medium truncate">{a.contact_first_name} {a.contact_last_name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{a.contact_email}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-semibold"
                      style={{ color: (a.funding_score || 0) >= 7 ? "var(--brand)" : (a.funding_score || 0) >= 5 ? "var(--warning)" : "var(--danger)" }}>
                      {a.funding_score || 0}/10
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm">{a.score_avg || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.estimated_funding || "—"}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
