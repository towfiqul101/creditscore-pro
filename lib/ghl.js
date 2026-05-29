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

export async function sendAnalysisResults({
  ghlApiKey,
  locationId,
  contactId,
  contactData,
  analysisUrl,
  analysisResults,
  sendSms,
  sendEmail,
  smsTemplate,
  emailSubject,
  brandName,
}) {
  var smsSent = false;
  var emailSent = false;
  var smsError = null;
  var emailError = null;

  if (sendSms && contactData.phone) {
    try {
      var defaultTemplate = "Hi [firstName]! Your credit analysis is ready. Score: [score]/10. View full report: [url]";
      var template = smsTemplate || defaultTemplate;
      var message = template
        .replace("[firstName]", contactData.firstName || "there")
        .replace("[lastName]", contactData.lastName || "")
        .replace("[score]", String(analysisResults.score || 0))
        .replace("[url]", analysisUrl);

      var smsRes = await fetch(GHL_BASE + "/conversations/messages", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + ghlApiKey,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "SMS",
          contactId: contactId,
          message: message,
        }),
      });

      if (!smsRes.ok) {
        var smsErrText = await smsRes.text();
        smsError = "SMS failed: " + smsRes.status + " " + smsErrText;
      } else {
        smsSent = true;
      }
    } catch (err) {
      smsError = err.message;
    }
  }

  if (sendEmail && contactData.email) {
    try {
      var subject = emailSubject || "Your Credit Analysis Results Are Ready";
      var html = buildResultsEmail(contactData, analysisResults, analysisUrl, brandName);

      var emailRes = await fetch(GHL_BASE + "/conversations/messages", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + ghlApiKey,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "Email",
          contactId: contactId,
          subject: subject,
          html: html,
        }),
      });

      if (!emailRes.ok) {
        var emailErrText = await emailRes.text();
        emailError = "Email failed: " + emailRes.status + " " + emailErrText;
      } else {
        emailSent = true;
      }
    } catch (err) {
      emailError = err.message;
    }
  }

  return { smsSent: smsSent, emailSent: emailSent, smsError: smsError, emailError: emailError };
}

function buildResultsEmail(contactData, analysisResults, analysisUrl, brandName) {
  var brand = brandName || "CreditScore Pro";
  var firstName = contactData.firstName || "there";
  var score = analysisResults.score || 0;
  var funding = analysisResults.estimatedFunding || "N/A";

  return [
    "<!DOCTYPE html><html><head><meta charset='utf-8'>",
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    "<style>body{margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
    ".wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);}",
    ".header{background:#111;padding:24px 32px;}",
    ".header h1{margin:0;font-size:20px;color:#fff;font-weight:700;}",
    ".body{padding:32px;}",
    ".score-box{background:#f9fafb;border-radius:10px;padding:20px 24px;margin:20px 0;text-align:center;}",
    ".score-num{font-size:48px;font-weight:800;color:#111;line-height:1;}",
    ".score-label{font-size:13px;color:#666;margin-top:4px;}",
    ".funding{font-size:15px;color:#444;margin:8px 0 0;}",
    ".cta{display:block;margin:24px 0;padding:14px 24px;background:#39FF14;color:#000;text-decoration:none;",
    "border-radius:8px;font-weight:700;font-size:15px;text-align:center;}",
    ".footer{padding:20px 32px;border-top:1px solid #eee;font-size:12px;color:#999;}</style></head><body>",
    "<div class='wrap'>",
    "<div class='header'><h1>" + brand + "</h1></div>",
    "<div class='body'>",
    "<p style='font-size:16px;color:#111;margin:0 0 8px;'>Hi " + firstName + ",</p>",
    "<p style='font-size:14px;color:#555;margin:0 0 4px;'>Your credit analysis is complete. Here's a summary:</p>",
    "<div class='score-box'>",
    "<div class='score-num'>" + score + "/10</div>",
    "<div class='score-label'>Funding Readiness Score</div>",
    "<div class='funding'>Estimated Funding Potential: <strong>" + funding + "</strong></div>",
    "</div>",
    "<a href='" + analysisUrl + "' class='cta'>View Full Report →</a>",
    "<p style='font-size:13px;color:#888;'>Your full report includes your bureau scores, a detailed breakdown of all 10 funding criteria, and a personalized action plan.</p>",
    "</div>",
    "<div class='footer'>This analysis was provided by " + brand + ". Reply to this email if you have questions.</div>",
    "</div></body></html>",
  ].join("");
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
