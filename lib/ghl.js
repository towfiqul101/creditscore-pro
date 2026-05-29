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
  tenantBranding,
}) {
  var smsSent = false;
  var emailSent = false;
  var smsError = null;
  var emailError = null;
  var conversationId = null;

  try {
    conversationId = await getOrCreateConversation(ghlApiKey, locationId, contactId);
    console.log("GHL conversation ID:", conversationId);
  } catch (err) {
    console.error("GHL getOrCreateConversation error:", err.message);
    return { smsSent: false, emailSent: false, smsError: err.message, emailError: err.message, conversationId: null };
  }

  if (sendSms && contactData.phone) {
    try {
      var defaultTemplate = "Hi [firstName]! Your credit analysis is ready. Score: [score]/10. View full report: [url]";
      var template = smsTemplate || defaultTemplate;
      var message = template
        .replace("[firstName]", contactData.firstName || "there")
        .replace("[lastName]", contactData.lastName || "")
        .replace("[score]", String(analysisResults.score || 0))
        .replace("[url]", analysisUrl);

      var smsResult = await sendSmsToConversation(ghlApiKey, conversationId, message);
      console.log("GHL SMS sent:", smsResult);
      smsSent = true;
    } catch (err) {
      smsError = err.message;
      console.error("SMS send error:", err.message);
    }
  }

  if (sendEmail && contactData.email) {
    try {
      var subject = emailSubject || "Your Credit Analysis Results Are Ready";
      var html = buildBrandedEmail(contactData, analysisResults, analysisUrl, tenantBranding);
      var emailResult = await sendEmailToConversation(ghlApiKey, conversationId, subject, html, contactData.email);
      console.log("GHL email sent:", emailResult);
      emailSent = true;
    } catch (err) {
      emailError = err.message;
      console.error("Email send error:", err.message);
    }
  }

  return { smsSent: smsSent, emailSent: emailSent, smsError: smsError, emailError: emailError, conversationId: conversationId };
}

async function getOrCreateConversation(apiKey, locationId, contactId) {
  var searchRes = await fetch(
    GHL_BASE + "/conversations/search?locationId=" + locationId + "&contactId=" + contactId,
    {
      method: "GET",
      headers: { "Authorization": "Bearer " + apiKey, "Version": "2021-07-28" },
    }
  );

  console.log("GHL conversation search status:", searchRes.status);

  if (searchRes.ok) {
    var searchData = await searchRes.json();
    var conversations = searchData.conversations || [];
    if (conversations.length > 0) {
      console.log("Found existing conversation:", conversations[0].id);
      return conversations[0].id;
    }
  } else {
    var searchErrText = await searchRes.text();
    console.warn("GHL conversation search failed:", searchRes.status, searchErrText);
  }

  var createRes = await fetch(GHL_BASE + "/conversations/", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locationId: locationId, contactId: contactId }),
  });

  console.log("GHL conversation create status:", createRes.status);

  if (!createRes.ok) {
    var createErrText = await createRes.text();
    throw new Error("Could not create conversation: " + createRes.status + " " + createErrText);
  }

  var createData = await createRes.json();
  var cid = createData.conversation ? createData.conversation.id : createData.id;
  console.log("Created new conversation:", cid);
  return cid;
}

async function sendSmsToConversation(apiKey, conversationId, message) {
  var res = await fetch(GHL_BASE + "/conversations/messages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "SMS", conversationId: conversationId, message: message }),
  });

  console.log("GHL SMS send status:", res.status);

  if (!res.ok) {
    var errText = await res.text();
    throw new Error("SMS send failed: " + res.status + " " + errText);
  }
  return await res.json();
}

async function sendEmailToConversation(apiKey, conversationId, subject, htmlBody, contactEmail) {
  var res = await fetch(GHL_BASE + "/conversations/messages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "Email",
      conversationId: conversationId,
      subject: subject,
      html: htmlBody,
      emailTo: contactEmail,
      emailReplyMode: "reply",
    }),
  });

  console.log("GHL email send status:", res.status);

  if (!res.ok) {
    var errText = await res.text();
    throw new Error("Email send failed: " + res.status + " " + errText);
  }
  return await res.json();
}

function buildBrandedEmail(contactData, analysisResults, analysisUrl, tenantBranding) {
  var branding = tenantBranding || {};
  var brandName = branding.brand_name || "CreditScore Pro";
  var brandColor = branding.brand_color || "#39FF14";
  var logoUrl = branding.logo_url || "";
  var websiteUrl = branding.website || "";
  var ceoName = branding.ceo_name || "";
  var ownerEmail = branding.owner_email || "";

  var firstName = contactData.firstName || "there";
  var score = analysisResults.score || 0;
  var avgScore = analysisResults.avgScore || "—";
  var estimatedFunding = analysisResults.estimatedFunding || "N/A";

  var scoreMsg = score >= 8
    ? "Great news — you appear funding ready!"
    : score >= 5
    ? "You’re on the right track. Review your action plan."
    : "Your report includes a personalized action plan to improve.";

  var logoSection = logoUrl
    ? '<a href="' + (websiteUrl || "#") + '" style="display:block;text-align:center;margin-bottom:18px;"><img src="' + logoUrl + '" alt="' + brandName + '" style="max-width:160px;height:auto;display:inline-block;" /></a>'
    : '<p style="text-align:center;font-size:20px;font-weight:700;color:' + brandColor + ';margin:0 0 18px;">' + brandName + "</p>";

  var footerLogoSection = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + brandName + '" style="height:22px;vertical-align:middle;margin-right:8px;" />'
    : "";

  var footerParts = [];
  if (ceoName) footerParts.push(ceoName);
  if (ownerEmail) footerParts.push('<a href="mailto:' + ownerEmail + '" style="color:#888;text-decoration:none;">' + ownerEmail + "</a>");
  if (websiteUrl) footerParts.push('<a href="' + websiteUrl + '" style="color:#888;text-decoration:none;">' + websiteUrl + "</a>");

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "</head>",
    '<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">',
    '<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">',
    '<div style="height:4px;background:' + brandColor + ';"></div>',
    '<div style="padding:36px 40px 28px;">',
    logoSection,
    '<p style="font-size:16px;font-weight:600;color:#111111;margin:0 0 6px;">Hi ' + firstName + ",</p>",
    '<p style="font-size:14px;color:#555555;margin:0 0 24px;line-height:1.6;">Your credit analysis report is ready.</p>',
    '<div style="height:1px;background:#eeeeee;margin-bottom:24px;"></div>',
    '<div style="background:#f8f8f8;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center;">',
    '<div style="font-size:56px;font-weight:800;color:' + brandColor + ';line-height:1;">' + score + "/10</div>",
    '<div style="font-size:13px;color:#666666;margin-top:6px;font-weight:500;">Funding Readiness Score</div>',
    '<div style="margin-top:12px;">',
    '<span style="font-size:13px;color:#444444;margin-right:16px;">FICO Avg: <strong>' + avgScore + "</strong></span>",
    '<span style="font-size:13px;color:#444444;">Est. Funding: <strong>' + estimatedFunding + "</strong></span>",
    "</div>",
    "</div>",
    '<div style="text-align:center;margin-bottom:24px;">',
    '<a href="' + analysisUrl + '" style="display:inline-block;padding:14px 32px;background:' + brandColor + ';color:#000000;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">View My Full Report &rarr;</a>',
    "</div>",
    '<div style="height:1px;background:#eeeeee;margin-bottom:20px;"></div>',
    '<p style="font-size:14px;color:#444444;margin:0 0 8px;line-height:1.6;">You passed <strong style="color:' + brandColor + ';">' + score + " out of 10</strong> funding criteria.</p>",
    '<p style="font-size:14px;color:#555555;margin:0 0 24px;line-height:1.6;">' + scoreMsg + "</p>",
    '<div style="height:1px;background:#eeeeee;margin-bottom:24px;"></div>',
    "</div>",
    '<div style="padding:20px 40px;background:#f4f4f4;border-top:1px solid #e8e8e8;">',
    '<div style="margin-bottom:8px;">' + footerLogoSection + '<strong style="color:#333333;font-size:14px;">' + brandName + "</strong></div>",
    footerParts.length > 0 ? '<p style="font-size:12px;color:#888888;margin:0 0 6px;line-height:1.7;">' + footerParts.join(" &nbsp;|&nbsp; ") + "</p>" : "",
    '<p style="font-size:12px;color:#aaaaaa;margin:12px 0 0;">This report was prepared by ' + brandName + ". If you have questions, reply to this email or contact us directly.</p>",
    '<div style="height:1px;background:#dddddd;margin:14px 0;"></div>',
    '<p style="font-size:11px;color:#bbbbbb;margin:0;text-align:center;">Powered by CreditScore Pro&#8482;</p>',
    "</div>",
    "</div>",
    "</body>",
    "</html>",
  ].join("\n");
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
