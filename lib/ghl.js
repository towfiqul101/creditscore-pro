// ─── GHL API v2 INTEGRATION ───────────────────────────────────────
// Syncs analysis results to a GHL sub-account via direct API calls
// No webhooks, no Zapier, no middleware — free

const GHL_API_BASE = "https://services.leadconnectorhq.com";

// Create or update a contact in GHL with analysis results
export async function syncToGHL({ ghlApiKey, locationId, contactData, analysisResults }) {
  if (!ghlApiKey || !locationId) return { success: false, error: "GHL not configured" };

  try {
    // Step 1: Search for existing contact by email
    const existing = await searchContact(ghlApiKey, locationId, contactData.email);

    let contactId;
    if (existing) {
      // Update existing contact
      contactId = existing.id;
      await updateContact(ghlApiKey, contactId, contactData, analysisResults);
    } else {
      // Create new contact
      contactId = await createContact(ghlApiKey, locationId, contactData, analysisResults);
    }

    // Step 2: Add tag to trigger GHL workflow (free trigger)
    await addTag(ghlApiKey, contactId, "analysis_complete");

    // Step 3: Add score-based tags
    if (analysisResults.score >= 8) {
      await addTag(ghlApiKey, contactId, "funding_ready");
    } else if (analysisResults.score >= 5) {
      await addTag(ghlApiKey, contactId, "needs_improvement");
    } else {
      await addTag(ghlApiKey, contactId, "significant_work_needed");
    }

    // Step 4: Add a note with analysis summary
    await addNote(ghlApiKey, contactId, formatAnalysisNote(analysisResults));

    return { success: true, contactId };
  } catch (error) {
    console.error("GHL sync error:", error);
    return { success: false, error: error.message };
  }
}

async function searchContact(apiKey, locationId, email) {
  const res = await fetch(`${GHL_API_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${email}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28" },
  });
  const data = await res.json();
  return data.contact || null;
}

async function createContact(apiKey, locationId, contactData, analysis) {
  const res = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({
      locationId,
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      email: contactData.email,
      phone: contactData.phone,
      customFields: buildCustomFields(analysis),
    }),
  });
  const data = await res.json();
  return data.contact?.id;
}

async function updateContact(apiKey, contactId, contactData, analysis) {
  await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      phone: contactData.phone,
      customFields: buildCustomFields(analysis),
    }),
  });
}

async function addTag(apiKey, contactId, tag) {
  await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({ tags: [tag] }),
  });
}

async function addNote(apiKey, contactId, body) {
  await fetch(`${GHL_API_BASE}/contacts/${contactId}/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({ body }),
  });
}

function buildCustomFields(analysis) {
  // These custom field keys need to match what's created in the client's GHL account
  // The tenant setup will map these to their specific custom field IDs
  return [
    { key: "credit_score_tu", field_value: String(analysis.bureauScores?.TransUnion || "") },
    { key: "credit_score_ex", field_value: String(analysis.bureauScores?.Experian || "") },
    { key: "credit_score_eq", field_value: String(analysis.bureauScores?.Equifax || "") },
    { key: "credit_score_avg", field_value: String(analysis.avgScore || "") },
    { key: "funding_readiness_score", field_value: `${analysis.score}/10` },
    { key: "funding_readiness_pct", field_value: `${analysis.percentage}%` },
    { key: "estimated_funding", field_value: analysis.estimatedFunding || "" },
    { key: "analysis_date", field_value: new Date().toISOString().split("T")[0] },
    { key: "criteria_passed", field_value: analysis.results?.filter(r => r.passed).map(r => r.criteriaId).join(",") || "" },
    { key: "criteria_failed", field_value: analysis.results?.filter(r => !r.passed).map(r => r.criteriaId).join(",") || "" },
  ];
}

function formatAnalysisNote(analysis) {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const passedItems = analysis.results?.filter(r => r.passed) || [];
  const failedItems = analysis.results?.filter(r => !r.passed) || [];

  return `
CreditScore Pro Analysis — ${date}

Funding Readiness: ${analysis.score}/10 (${analysis.percentage}%)
Average FICO 8: ${analysis.avgScore}
Estimated Funding: ${analysis.estimatedFunding}

Bureau Scores:
- TransUnion: ${analysis.bureauScores?.TransUnion}
- Experian: ${analysis.bureauScores?.Experian}
- Equifax: ${analysis.bureauScores?.Equifax}

Passed (${passedItems.length}): ${passedItems.map(r => `#${r.criteriaId}`).join(", ") || "None"}
Needs Work (${failedItems.length}): ${failedItems.map(r => `#${r.criteriaId}`).join(", ") || "None"}

— Generated by CreditScore Pro
  `.trim();
}

// ─── GHL CUSTOM FIELD SETUP GUIDE ─────────────────────────────────
// The client needs to create these custom fields in their GHL sub-account:
// 1. credit_score_tu (Text)
// 2. credit_score_ex (Text)
// 3. credit_score_eq (Text)
// 4. credit_score_avg (Text)
// 5. funding_readiness_score (Text)
// 6. funding_readiness_pct (Text)
// 7. estimated_funding (Text)
// 8. analysis_date (Text)
// 9. criteria_passed (Text)
// 10. criteria_failed (Text)
