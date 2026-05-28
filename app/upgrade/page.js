"use client";

export default function UpgradePage() {
  var features = [
    { icon: "📊", title: "300 analyses / month", desc: "Run unlimited client reports without hitting a wall." },
    { icon: "🔗", title: "GHL CRM auto-sync", desc: "Every analysis pushes contact + results to your GHL pipeline." },
    { icon: "📩", title: "Automated client outreach", desc: "SMS + email sent to clients automatically with their results." },
    { icon: "💬", title: "Priority WhatsApp support", desc: "Get answers from our team fast — no ticket queue." },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            margin: "0 auto 16px", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "16px", fontWeight: "700",
            background: "rgba(57,255,20,0.12)", color: "var(--brand)",
          }}>CS</div>
          <div style={{
            display: "inline-block", padding: "4px 12px", borderRadius: "20px",
            background: "rgba(255,165,0,0.12)", border: "1px solid rgba(255,165,0,0.3)",
            color: "#FFA500", fontSize: "11px", fontWeight: "600",
            letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "16px",
          }}>Free limit reached</div>
          <h1 style={{ fontSize: "26px", fontWeight: "700", margin: "0 0 10px", color: "var(--text)", lineHeight: 1.2 }}>
            You{"'"}ve used all 3 free analyses
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            Upgrade to keep running analyses and unlock GHL CRM sync for your entire client roster.
          </p>
        </div>

        {/* Feature grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
          marginBottom: "32px",
        }}>
          {features.map(function(f) {
            return (
              <div key={f.title} style={{
                padding: "18px 16px", borderRadius: "14px",
                background: "var(--bg-card)", border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: "22px", marginBottom: "8px" }}>{f.icon}</div>
                <p style={{ fontSize: "13px", fontWeight: "700", margin: "0 0 4px", color: "var(--text)" }}>
                  {f.title}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <a
            href="https://wa.me/+8801874836365?text=Hi%2C%20I%27d%20like%20to%20upgrade%20my%20CreditScore%20Pro%20account"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", width: "100%", padding: "15px",
              borderRadius: "12px", background: "var(--brand)",
              color: "#000", fontSize: "15px", fontWeight: "700",
              textDecoration: "none", boxSizing: "border-box",
              marginBottom: "14px",
            }}>
            Upgrade via WhatsApp →
          </a>

          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 8px" }}>
            or email us at{" "}
            <a href="mailto:towfiqul.pro@gmail.com" style={{ color: "var(--brand)", textDecoration: "none" }}>
              towfiqul.pro@gmail.com
            </a>
          </p>

          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 24px" }}>
            Pro plan — $97/month · No contracts · Cancel anytime
          </p>

          <a href="/dashboard" style={{
            fontSize: "13px", color: "var(--text-muted)",
            textDecoration: "none",
          }}>
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
