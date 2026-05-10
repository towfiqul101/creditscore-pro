// ─── 10 FUNDING READINESS CRITERIA ────────────────────────────────
export const CRITERIA = [
  { id: 1, key: "ficoScore", label: "700+ FICO 8 Score", impact: "High", description: "FICO 8 score of 700 or above across all bureaus" },
  { id: 2, key: "personalInfo", label: "Correct Personal Info", impact: "Medium", description: "Name, address, SSN, employer matches across bureaus" },
  { id: 3, key: "cleanReport", label: "Clean Report (No Errors)", impact: "High", description: "No inaccurate accounts, balances, or reporting errors" },
  { id: 4, key: "utilization", label: "Utilization <30%", impact: "High", description: "Credit utilization under 30% on each individual card" },
  { id: 5, key: "primaryAccounts", label: "4+ Primary Accounts", impact: "Medium", description: "At least 4 open primary tradelines" },
  { id: 6, key: "creditAge", label: "Avg Credit Age 2+ Yrs", impact: "Medium", description: "Average age of all accounts is 2 years or older" },
  { id: 7, key: "latePayments", label: "No Late Payments (24 Mo)", impact: "High", description: "Zero late payments in the last 24 months" },
  { id: 8, key: "negativeItems", label: "No Negative Items", impact: "High", description: "No collections, charge-offs, bankruptcies" },
  { id: 9, key: "highLimitCard", label: "One $10K+ Primary Card", impact: "Medium", description: "At least one primary card with $10K+ limit" },
  { id: 10, key: "inquiries", label: "Max 2 Inquiries/Bureau", impact: "Medium", description: "No more than 2 hard inquiries per bureau in 24 months" },
];

// ─── LOCAL ANALYSIS ENGINE (rule-based scoring) ───────────────────
export function analyzeCredit(data) {
  const results = [];
  let passed = 0;

  const scores = {
    TransUnion: +data.scoreTU || 0,
    Experian: +data.scoreEX || 0,
    Equifax: +data.scoreEQ || 0,
  };
  const avg = Math.round((scores.TransUnion + scores.Experian + scores.Equifax) / 3);

  // 1. FICO Score
  const fp = avg >= 700;
  if (fp) passed++;
  results.push({
    criteriaId: 1, passed: fp, value: avg,
    rating: avg >= 750 ? "Excellent" : avg >= 700 ? "Good" : avg >= 650 ? "Fair" : "Needs work",
    bureauData: scores,
    explanation: fp
      ? `Average FICO 8 is ${avg}, meeting the 700+ threshold. TransUnion: ${scores.TransUnion}, Experian: ${scores.Experian}, Equifax: ${scores.Equifax}.`
      : `Average FICO 8 is ${avg}, below 700. Focus on the bureau(s) with the lowest score first.`,
    action: fp
      ? "Maintain on-time payments and low utilization to protect this score."
      : "Pay down balances below 30% utilization and ensure all payments are on time. Each 10-point increase significantly improves funding options.",
  });

  // 2. Personal Info
  const pi = data.personalInfo === "yes";
  if (pi) passed++;
  results.push({
    criteriaId: 2, passed: pi, value: pi ? "Verified" : "Issues found",
    rating: pi ? "Excellent" : "Needs work",
    explanation: pi
      ? "Personal information is consistent and accurate across all three bureaus."
      : "Discrepancies found in personal information. Incorrect names, addresses, or employers can cause funding denials.",
    action: pi
      ? "No action needed. Continue monitoring for accuracy."
      : "File disputes with each bureau showing incorrect info. Include proof of correct name, address, and SSN. This is often the fastest win.",
  });

  // 3. Clean Report
  const ec = +data.errors || 0;
  const cp = ec === 0;
  if (cp) passed++;
  results.push({
    criteriaId: 3, passed: cp, value: cp ? "Clean" : `${ec} error${ec > 1 ? "s" : ""}`,
    rating: cp ? "Excellent" : "Needs work",
    explanation: cp
      ? "No reporting errors detected. Your credit report is clean and accurate."
      : `${ec} reporting error${ec > 1 ? "s" : ""} found. These may include incorrect balances, wrong account statuses, or accounts that don't belong to you.`,
    action: cp
      ? "Monitor reports monthly for new errors."
      : "Dispute each error individually with the reporting bureau. Under FCRA, bureaus have 30 days to investigate and respond.",
  });

  // 4. Utilization
  const ut = +data.utilization || 0;
  const up = ut <= 30;
  if (up) passed++;
  results.push({
    criteriaId: 4, passed: up, value: `${ut}%`,
    rating: ut <= 10 ? "Excellent" : ut <= 30 ? "Good" : ut <= 50 ? "Fair" : "Needs work",
    explanation: up
      ? `Utilization at ${ut}%, under the 30% threshold.${ut <= 10 ? " Under 10% is ideal for maximum score benefit." : ""}`
      : `Utilization at ${ut}%, above 30%. This is the single fastest factor you can fix to improve your score.`,
    action: up
      ? "Keep utilization under 30%, ideally under 10% for best scores."
      : "Pay down card balances aggressively. Request credit limit increases on existing cards. Don't close old cards — it reduces your available credit.",
  });

  // 5. Primary Accounts
  const pa = +data.primaryAccounts || 0;
  const pp = pa >= 4;
  if (pp) passed++;
  results.push({
    criteriaId: 5, passed: pp, value: `${pa}`,
    rating: pa >= 6 ? "Excellent" : pa >= 4 ? "Good" : pa >= 2 ? "Fair" : "Needs work",
    explanation: pp
      ? `${pa} primary accounts meets the 4+ threshold for a strong credit mix.`
      : `Only ${pa} primary account${pa !== 1 ? "s" : ""}. Lenders want to see at least 4 active tradelines.`,
    action: pp
      ? "Maintain existing accounts in good standing."
      : "Consider becoming an authorized user on a family member's card, or opening a secured credit card to build tradelines.",
  });

  // 6. Credit Age
  const ca = +data.creditAge || 0;
  const cap = ca >= 2;
  if (cap) passed++;
  results.push({
    criteriaId: 6, passed: cap, value: `${ca} yr${ca !== 1 ? "s" : ""}`,
    rating: ca >= 7 ? "Excellent" : ca >= 4 ? "Good" : ca >= 2 ? "Fair" : "Needs work",
    explanation: cap
      ? `Average credit age is ${ca} years, meeting the 2+ year requirement.`
      : `Average credit age is only ${ca} year${ca !== 1 ? "s" : ""}, below the 2-year minimum.`,
    action: cap
      ? "Keep oldest accounts open to maintain credit age."
      : "Don't close old accounts. Avoid opening unnecessary new accounts which lower your average age. Time is the only fix.",
  });

  // 7. Late Payments
  const lp = +data.latePayments || 0;
  const lpp = lp === 0;
  if (lpp) passed++;
  results.push({
    criteriaId: 7, passed: lpp, value: lp === 0 ? "None" : `${lp}`,
    rating: lp === 0 ? "Excellent" : lp <= 1 ? "Fair" : "Needs work",
    explanation: lpp
      ? "Zero late payments in the last 24 months. Perfect payment history."
      : `${lp} late payment${lp > 1 ? "s" : ""} found in the last 24 months. Payment history accounts for 35% of your score.`,
    action: lpp
      ? "Continue perfect payment history. Set up autopay as a backup."
      : "Set up autopay for at least minimums on all accounts. For one-time late payments, contact the creditor and request a goodwill removal.",
  });

  // 8. Negative Items
  const ni = +data.negativeItems || 0;
  const nip = ni === 0;
  if (nip) passed++;
  results.push({
    criteriaId: 8, passed: nip, value: ni === 0 ? "None" : `${ni}`,
    rating: ni === 0 ? "Excellent" : "Needs work",
    explanation: nip
      ? "No negative items found on your credit file."
      : `${ni} negative item${ni > 1 ? "s" : ""} detected (collections, charge-offs, or public records). These have the most severe impact on your score.`,
    action: nip
      ? "Keep monitoring monthly for any new negative items."
      : "Dispute any inaccurate negative items. For valid collections, negotiate pay-for-delete agreements. Work with your credit repair specialist on a removal strategy.",
  });

  // 9. High Limit Card
  const hl = +data.highestLimit || 0;
  const hlp = hl >= 10000;
  if (hlp) passed++;
  results.push({
    criteriaId: 9, passed: hlp, value: `$${hl.toLocaleString()}`,
    rating: hl >= 25000 ? "Excellent" : hl >= 10000 ? "Good" : hl >= 5000 ? "Fair" : "Needs work",
    explanation: hlp
      ? `Highest card limit is $${hl.toLocaleString()}, exceeding the $10K threshold for prime funding qualification.`
      : `Highest limit is $${hl.toLocaleString()}, below the $10K target. Higher limits demonstrate creditworthiness to lenders.`,
    action: hlp
      ? "Maintain this account in excellent standing."
      : "Request credit limit increases every 6 months on existing cards. Consider applying for cards known for higher starting limits once other criteria improve.",
  });

  // 10. Inquiries
  const inq = +data.inquiries || 0;
  const iqp = inq <= 2;
  if (iqp) passed++;
  results.push({
    criteriaId: 10, passed: iqp, value: `${inq}`,
    rating: inq <= 2 ? "Excellent" : inq <= 4 ? "Fair" : "Needs work",
    explanation: iqp
      ? `${inq} hard inquir${inq === 1 ? "y" : "ies"} per bureau, within the safe range.`
      : `${inq} inquiries per bureau exceeds the recommended maximum of 2. Each inquiry can impact your score by 5-10 points.`,
    action: iqp
      ? "Be selective about new credit applications."
      : "Stop applying for new credit until existing inquiries age off (2 years). When you do apply, rate-shop within 14-day windows.",
  });

  // Estimate funding potential
  const estimatedFunding = avg >= 700
    ? (hl >= 10000 ? "$100K-$250K+" : "$50K-$150K")
    : avg >= 650
      ? "$25K-$75K"
      : avg >= 600
        ? "$10K-$30K"
        : "Limited options";

  return {
    results,
    score: passed,
    total: 10,
    percentage: Math.round((passed / 10) * 100),
    avgScore: avg,
    estimatedFunding,
    bureauScores: scores,
    analyzedAt: new Date().toISOString(),
  };
}
