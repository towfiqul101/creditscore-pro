// lib/pdf-report.js
// Pure client-side PDF generation using jsPDF
// No special fonts needed — uses built-in Helvetica

import jsPDF from "jspdf";

// Sanitize text: strip anything jsPDF can't handle with built-in fonts
function safe(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\u2014]/g, "--")   // em dash
    .replace(/[\u2013]/g, "-")    // en dash
    .replace(/[\u2018\u2019]/g, "'")  // curly quotes
    .replace(/[\u201C\u201D]/g, '"')  // curly double quotes
    .replace(/[\u2022]/g, "-")    // bullet
    .replace(/[\u00A0]/g, " ")    // non-breaking space
    .replace(/[^\x00-\x7F]/g, "") // strip any remaining non-ASCII
    .trim();
}

// Word-wrap text to fit within maxWidth at given font size
function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(safe(text), maxWidth);
}

export function generatePDFReport({ analysis, contactInfo }) {
  var doc = new jsPDF({ unit: "pt", format: "letter" });

  var pageW = doc.internal.pageSize.getWidth();
  var pageH = doc.internal.pageSize.getHeight();
  var margin = 48;
  var contentW = pageW - margin * 2;
  var y = margin;

  // ── Helper: check if we need a new page ──────────────────
  function checkPage(needed) {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // ── Helper: draw a horizontal rule ───────────────────────
  function rule() {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  }

  // ── HEADER ───────────────────────────────────────────────
  // Green accent bar
  doc.setFillColor(57, 255, 20);
  doc.rect(0, 0, pageW, 6, "F");

  y = 36;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text("CreditScore Pro", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  var dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.text("Credit Analysis Report  |  " + dateStr, margin, y);
  y += 28;

  rule();

  // ── CONTACT INFO ─────────────────────────────────────────
  var name = safe((contactInfo.firstName || "") + " " + (contactInfo.lastName || "")).trim();
  if (name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(name, margin, y);
    y += 16;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  if (contactInfo.email) { doc.text(safe(contactInfo.email), margin, y); y += 13; }
  if (contactInfo.phone) { doc.text(safe(contactInfo.phone), margin, y); y += 13; }
  y += 10;

  rule();

  // ── SCORE SUMMARY BOX ────────────────────────────────────
  checkPage(100);

  var boxH = 80;
  doc.setFillColor(245, 255, 245);
  doc.setDrawColor(57, 255, 20);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin, y, contentW, boxH, 6, 6, "FD");

  // Funding readiness score
  var score = analysis.score || 0;
  var pct = analysis.percentage || 0;
  var funding = safe(analysis.estimatedFunding || "N/A");
  var avgScore = analysis.avgScore || 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(20, 100, 20);
  doc.text(score + "/10", margin + 20, y + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Funding Readiness", margin + 20, y + 62);

  // Bureau scores
  var colW = contentW / 3;
  var bureaus = [
    { label: "TransUnion", val: analysis.bureauScores ? analysis.bureauScores[0] : 0 },
    { label: "Experian",   val: analysis.bureauScores ? analysis.bureauScores[1] : 0 },
    { label: "Equifax",    val: analysis.bureauScores ? analysis.bureauScores[2] : 0 },
  ];

  bureaus.forEach(function (b, i) {
    var bx = margin + contentW * 0.38 + i * (contentW * 0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text(String(b.val || 0), bx, y + 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(b.label, bx, y + 54);
  });

  // Estimated funding - right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(funding, pageW - margin - 20, y + 36, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Est. Funding Potential", pageW - margin - 20, y + 50, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Avg FICO " + avgScore, pageW - margin - 20, y + 68, { align: "right" });

  y += boxH + 24;

  // ── CRITERIA RESULTS ─────────────────────────────────────
  var results = analysis.results || [];
  var passed = results.filter(function (r) { return r.passed; });
  var failed = results.filter(function (r) { return !r.passed; });

  // STRENGTHS
  if (passed.length > 0) {
    checkPage(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 120, 20);
    doc.text("Strengths (" + passed.length + ")", margin, y);
    y += 16;

    passed.forEach(function (item) {
      checkPage(50);

      // Green checkmark label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 120, 20);
      doc.text("+ " + safe(item.label || ""), margin, y);
      y += 13;

      // Criterion value if present
      if (item.value !== undefined && item.value !== null) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text("Current value: " + safe(String(item.value)), margin + 12, y);
        y += 12;
      }

      // Action text
      if (item.action) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        var lines = wrapText(doc, item.action, contentW - 12);
        lines.forEach(function (line) {
          checkPage(14);
          doc.text(line, margin + 12, y);
          y += 12;
        });
      }

      y += 4;
    });

    y += 8;
  }

  // NEEDS WORK
  if (failed.length > 0) {
    checkPage(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(180, 40, 40);
    doc.text("Needs Work (" + failed.length + ")", margin, y);
    y += 16;

    failed.forEach(function (item) {
      checkPage(50);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(180, 40, 40);
      doc.text("- " + safe(item.label || ""), margin, y);
      y += 13;

      if (item.value !== undefined && item.value !== null) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text("Current value: " + safe(String(item.value)), margin + 12, y);
        y += 12;
      }

      if (item.action) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        var lines = wrapText(doc, item.action, contentW - 12);
        lines.forEach(function (line) {
          checkPage(14);
          doc.text(line, margin + 12, y);
          y += 12;
        });
      }

      y += 4;
    });

    y += 8;
  }

  // ── AI SUMMARY ───────────────────────────────────────────
  if (analysis.summary) {
    checkPage(50);
    rule();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("AI Assessment", margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    var summaryLines = wrapText(doc, analysis.summary, contentW);
    summaryLines.forEach(function (line) {
      checkPage(14);
      doc.text(line, margin, y);
      y += 13;
    });

    y += 8;
  }

  // ── PRIORITY ACTIONS ─────────────────────────────────────
  var actions = analysis.priorityActions || [];
  if (actions.length > 0) {
    checkPage(40);
    rule();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("Priority Action Plan", margin, y);
    y += 16;

    actions.forEach(function (action, i) {
      checkPage(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(57, 160, 20);
      doc.text(String(i + 1) + ".", margin, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      var lines = wrapText(doc, action, contentW - 20);
      lines.forEach(function (line, li) {
        checkPage(14);
        doc.text(line, margin + 18, y);
        y += 13;
      });
      y += 4;
    });
  }

  // ── FOOTER on every page ─────────────────────────────────
  var totalPages = doc.internal.getNumberOfPages();
  for (var p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(57, 255, 20);
    doc.rect(0, pageH - 4, pageW, 4, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "CreditScore Pro  |  Confidential  |  Page " + p + " of " + totalPages,
      margin,
      pageH - 14
    );
    doc.text(
      "Generated " + dateStr,
      pageW - margin,
      pageH - 14,
      { align: "right" }
    );
  }

  return doc;
}

// Call this from the browser (client component)
export function downloadPDF(analysis, contactInfo) {
  var doc = generatePDFReport({ analysis: analysis, contactInfo: contactInfo });
  var firstName = safe(contactInfo.firstName || "Client");
  var lastName = safe(contactInfo.lastName || "");
  var filename = "CreditScore-Pro-" + firstName + (lastName ? "-" + lastName : "") + ".pdf";
  doc.save(filename);
}
