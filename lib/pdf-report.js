import jsPDF from "jspdf";
import "jspdf-autotable";
import { CRITERIA } from "./analysis";

export function generatePDFReport({ analysis, contactInfo, tenantBranding }) {
  const doc = new jsPDF();
  const brand = tenantBranding || { name: "CreditScore Pro", color: [57, 255, 20] };
  const [r, g, b] = brand.color;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // ─── HEADER ───────────────────────────────────────────────────
  doc.setFillColor(10, 15, 10);
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setTextColor(r, g, b);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(brand.name || "CreditScore Pro", 15, 20);
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text("AI-Powered Credit Analysis Report", 15, 28);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), pageWidth - 15, 20, { align: "right" });
  doc.text(`Prepared for ${contactInfo?.firstName || ""} ${contactInfo?.lastName || ""}`, pageWidth - 15, 28, { align: "right" });

  y = 55;

  // ─── SCORE SUMMARY ────────────────────────────────────────────
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Funding Readiness Score", 15, y);
  y += 10;

  // Score box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(15, y, 55, 30, 3, 3, "F");
  doc.setFontSize(28);
  doc.setTextColor(r, g, b);
  doc.setFont("helvetica", "bold");
  doc.text(`${analysis.score}/10`, 42.5, y + 20, { align: "center" });

  // Bureau scores
  const bureaus = [
    { name: "TransUnion", score: analysis.bureauScores?.TransUnion },
    { name: "Experian", score: analysis.bureauScores?.Experian },
    { name: "Equifax", score: analysis.bureauScores?.Equifax },
  ];
  let bx = 80;
  bureaus.forEach((bureau) => {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(bx, y, 38, 30, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(bureau.name, bx + 19, y + 10, { align: "center" });
    doc.setFontSize(18);
    const scoreColor = bureau.score >= 700 ? [15, 175, 60] : bureau.score >= 650 ? [255, 184, 0] : [255, 68, 68];
    doc.setTextColor(...scoreColor);
    doc.setFont("helvetica", "bold");
    doc.text(String(bureau.score || "N/A"), bx + 19, y + 24, { align: "center" });
    bx += 42;
  });

  y += 40;

  // Summary line
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`Average FICO 8: ${analysis.avgScore}  |  Estimated Funding: ${analysis.estimatedFunding}  |  ${analysis.score} of 10 criteria passed`, 15, y);
  y += 15;

  // ─── CRITERIA TABLE ───────────────────────────────────────────
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text("10-Point Funding Readiness Breakdown", 15, y);
  y += 8;

  const tableData = analysis.results.map((result, idx) => {
    const criteria = CRITERIA[idx];
    return [
      `${String(result.criteriaId).padStart(2, "0")}`,
      criteria?.label || `Criteria ${result.criteriaId}`,
      result.passed ? "PASS" : "FAIL",
      String(result.value),
      result.rating,
      criteria?.impact || "",
    ];
  });

  doc.autoTable({
    startY: y,
    head: [["#", "Criteria", "Status", "Value", "Rating", "Impact"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [10, 15, 10], textColor: [r, g, b], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === "body") {
        if (data.cell.raw === "PASS") {
          data.cell.styles.textColor = [15, 175, 60];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [255, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 15;

  // ─── ACTION PLANS ─────────────────────────────────────────────
  // Check if we need a new page
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text("Personalized Action Plan", 15, y);
  y += 10;

  const failedCriteria = analysis.results.filter((r) => !r.passed);
  const passedCriteria = analysis.results.filter((r) => r.passed);

  if (failedCriteria.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(255, 68, 68);
    doc.setFont("helvetica", "bold");
    doc.text(`Priority Items (${failedCriteria.length})`, 15, y);
    y += 7;

    failedCriteria.forEach((result) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const criteria = CRITERIA.find((c) => c.id === result.criteriaId);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "bold");
      doc.text(`${criteria?.label || ""} — ${result.value}`, 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(result.action, pageWidth - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4.5 + 5;
    });
  }

  y += 5;
  if (y > 250) { doc.addPage(); y = 20; }

  if (passedCriteria.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(15, 175, 60);
    doc.setFont("helvetica", "bold");
    doc.text(`Strengths (${passedCriteria.length})`, 15, y);
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    passedCriteria.forEach((result) => {
      const criteria = CRITERIA.find((c) => c.id === result.criteriaId);
      doc.text(`✓ ${criteria?.label || ""} — ${result.value}`, 15, y);
      y += 5;
    });
  }

  // ─── FOOTER ───────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(245, 245, 245);
    doc.rect(0, doc.internal.pageSize.getHeight() - 15, pageWidth, 15, "F");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${brand.name || "CreditScore Pro"} | Confidential | Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
  }

  return doc;
}
