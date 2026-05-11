// ─── GHL API v2 INTEGRATION ───────────────────────────────────────
// lib/ghl.js
// Returns: { success: boolean, contactId: string|null, error: string|null }

var GHL_BASE = "https://services.leadconnectorhq.com";

export async function syncToGHL({ ghlApiKey, locationId, contactData, analysisResults }) {
  if (!ghlApiKey || !locationId) {
    return { success: false, contactId: null, error: "GHL not configured — missing API key or location ID" };
  }

  try {
    // Step 1: Search for existing contact by email
    var existingId = await findContactByEmail(ghlApiKey, locationId, contactData.email);

    var contactId;
    if (existingId) {
      // Update existing contact
      await updateContact(ghlApiKey, existingId, contactData, analysisResults, locationId);
      contactId = existingId;
    } else {
      // Create new contact
      contactId = await createContact(ghlApiKey, locationId, contactData, analysisResults);
    }

    if (!contactId) {
      return { success: false, contactId: null, error: "Failed to create or find contact in GHL" };
    }

    // Step 2: Add analysis_complete tag (triggers GHL workflow)
    await addTag(ghlApiKey, contactId, "analysis_complete");

    // Step 3: Add score-based tag
    var score = analysisResults.score || 0;
    if (score >= 8) {
      await addTag(ghlApiKey, contactId, "funding_ready");
    } else if (score >= 5) {
      await addTag(ghlApiKey, contactId, "needs_improvement");
    } else {
      await addTag(ghlApiKey, contactId, "significant_work_needed");
    }

    return { success: true, contactId: contactId, error: null };

  } catch (err) {
    console.error("GHL sync error:", err);
    return { success: false, contactId: null, error: err.message };
  }
}

async function findContactByEmail(apiKey, locationId, email) {
  if (!email) return null;

  try {
    var res = await fetch(
      GHL_BASE + "/contacts/search/duplicate?locationId=" + locationId + "&email=" + encodeURIComponent(email),
      {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return null;

    var data = await res.json();
    return data.contact ? data.contact.id : null;

  } catch (err) {
    console.error("GHL search error:", err);
    return null;
  }
}

async function createContact(apiKey, locationId, contactData, analysisResults) {
  var body = {
    locationId: locationId,
    firstName: contactData.firstName || "",
    lastName: contactData.lastName || "",
    email: contactData.email || "",
    phone: contactData.phone || "",
    customFields: buildCustomFields(analysisResults),
    tags: [],
  };

  var res = await fetch(GHL_BASE + "/contacts/", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    var errText = await res.text();
    throw new Error("GHL create contact failed: " + res.status + " " + errText);
  }

  var data = await res.json();
  return data.contact ? data.contact.id : null;
}

async function updateContact(apiKey, contactId, contactData, analysisResults, locationId) {
  var body = {
    firstName: contactData.firstName || "",
    lastName: contactData.lastName || "",
    phone: contactData.phone || "",
    customFields: buildCustomFields(analysisResults),
  };

  var res = await fetch(GHL_BASE + "/contacts/" + contactId, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    var errText = await res.text();
    throw new Error("GHL update contact failed: " + res.status + " " + errText);
  }
}

async function addTag(apiKey, contactId, tag) {
  try {
    var res = await fetch(GHL_BASE + "/contacts/" + contactId + "/tags", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags: [tag] }),
    });

    if (!res.ok) {
      console.warn("GHL add tag failed for tag:", tag, "status:", res.status);
    }
  } catch (err) {
    console.warn("GHL add tag error:", err);
    // Don't throw — tag failure shouldn't break the whole sync
  }
}

function buildCustomFields(analysisResults) {
  var passed = (analysisResults.results || [])
    .filter(function (r) { return r.passed; })
    .map(function (r) { return r.label; })
    .join(", ");

  var failed = (analysisResults.results || [])
    .filter(function (r) { return !r.passed; })
    .map(function (r) { return r.label; })
    .join(", ");

  return [
    { key: "credit_score_tu", field_value: String(analysisResults.bureauScores ? analysisResults.bureauScores[0] || "" : "") },
    { key: "credit_score_ex", field_value: String(analysisResults.bureauScores ? analysisResults.bureauScores[1] || "" : "") },
    { key: "credit_score_eq", field_value: String(analysisResults.bureauScores ? analysisResults.bureauScores[2] || "" : "") },
    { key: "credit_score_avg", field_value: String(analysisResults.avgScore || "") },
    { key: "funding_readiness_score", field_value: String(analysisResults.score || "") + "/10" },
    { key: "funding_readiness_pct", field_value: String(analysisResults.percentage || "") + "%" },
    { key: "estimated_funding", field_value: analysisResults.estimatedFunding || "" },
    { key: "analysis_date", field_value: new Date().toLocaleDateString("en-US") },
    { key: "criteria_passed", field_value: passed },
    { key: "criteria_failed", field_value: failed },
  ];
}
