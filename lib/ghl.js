// ─── GHL API v2 INTEGRATION ───────────────────────────────────────
// lib/ghl.js
// Returns: { success: boolean, contactId: string|null, error: string|null }

var GHL_BASE = "https://services.leadconnectorhq.com";

export async function syncToGHL({ ghlApiKey, locationId, contactData, analysisResults }) {
  if (!ghlApiKey || !locationId) {
    return { success: false, contactId: null, error: "GHL not configured — missing API key or location ID" };
  }

  try {
    var existingId = await findContactByEmail(ghlApiKey, locationId, contactData.email);

    var contactId;
    if (existingId) {
      await updateContact(ghlApiKey, existingId, contactData, analysisResults, locationId);
      contactId = existingId;
    } else {
      contactId = await createContact(ghlApiKey, locationId, contactData, analysisResults);
    }

    if (!contactId) {
      return { success: false, contactId: null, error: "Failed to create or find contact in GHL" };
    }

    await addTag(ghlApiKey, contactId, "analysis_complete");

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
  }
}

export async function sendAnalysisResults({
  ghlApiKey,
  locationId,
  contactId,
  contactData,
  analysisUrl,
  analysisData,
  sendSms,
  sendEmail,
  emailType,
  emailSubject,
  tenantBranding,
  stepConfig,
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
      var message = buildSmsMessage({
        template: stepConfig && stepConfig.sms_template,
        contactData: contactData,
        score: analysisData ? analysisData.score : 0,
        url: analysisUrl,
        ctaEnabled: stepConfig && stepConfig.cta_enabled,
        ctaText: stepConfig && stepConfig.cta_text,
        ctaUrl: stepConfig && stepConfig.cta_url,
      });

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
      var subject = emailSubject || "Your Credit Analysis Report Is Ready";
      var html;
      if (emailType === "full_results") {
        html = buildFullResultsEmail({
          contactData: contactData,
          analysisData: analysisData,
          analysisUrl: analysisUrl,
          tenantBranding: tenantBranding,
          stepConfig: stepConfig,
        });
      } else {
        html = buildCustomEmail({
          contactData: contactData,
          analysisUrl: analysisUrl,
          tenantBranding: tenantBranding,
          stepConfig: stepConfig,
        });
      }

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

// ─── EMAIL BUILDERS ───────────────────────────────────────────────

function safeBrandColor(raw) {
  var c = raw || "#39FF14";
  return c.startsWith("#") ? c : "#" + c;
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 57, g: 255, b: 20 };
}

function bureauScoreColor(score, brandColor) {
  if (score >= 700) return brandColor;
  if (score >= 650) return "#ff9800";
  return "#f44336";
}

export function buildFullResultsEmail({ contactData, analysisData, analysisUrl, tenantBranding, stepConfig }) {
  var branding = tenantBranding || {};
  var step = stepConfig || {};

  var brandName = branding.brand_name || "CreditScore Pro";
  var brandColor = safeBrandColor(branding.brand_color);
  var logoUrl = branding.logo_url || "";
  var websiteUrl = branding.website || "";
  var ceoName = branding.ceo_name || "";
  var ownerEmail = branding.owner_email || "";

  var firstName = (contactData && contactData.firstName) || "there";
  var lastName = (contactData && contactData.lastName) || "";

  var score = (analysisData && analysisData.score) || 0;
  var avgScore = (analysisData && analysisData.avgScore) || "—";
  var estimatedFunding = (analysisData && analysisData.estimatedFunding) || "N/A";
  var bureauScores = (analysisData && analysisData.bureauScores) || {};
  var results = (analysisData && analysisData.results) || [];
  var priorityActions = (analysisData && analysisData.priorityActions) || [];

  var emailIntro = step.email_intro ||
    "Your credit analysis report is ready. Here’s a complete breakdown of your current credit profile and funding readiness score.";
  var ctaEnabled = step.cta_enabled && step.cta_url;
  var ctaText = step.cta_text || "Book a Free Consultation";
  var ctaUrl = step.cta_url || "";

  var passed = results.filter(function (r) { return r.passed; }).slice(0, 5);
  var failed = results.filter(function (r) { return !r.passed; }).slice(0, 5);
  var actions = priorityActions.slice(0, 3);

  var bureauList = [
    { name: "TransUnion", score: bureauScores.TransUnion || 0 },
    { name: "Experian", score: bureauScores.Experian || 0 },
    { name: "Equifax", score: bureauScores.Equifax || 0 },
  ];

  var rgb = hexToRgb(brandColor);
  var brandColorAlpha8 = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.08)";

  var logoHtml = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + brandName + '" style="height:48px;max-width:180px;display:inline-block;vertical-align:middle;" />'
    : "";

  var footerLogoHtml = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + brandName + '" style="height:24px;vertical-align:middle;margin-right:8px;" />'
    : "";

  var p = [];

  p.push("<!DOCTYPE html>");
  p.push("<html>");
  p.push('<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>');
  p.push('<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">');

  // Outer table wrapper
  p.push('<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:24px 0;">');
  p.push("<tr><td align=\"center\">");

  // Inner container table
  p.push('<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;margin:0 auto;">');

  // [1] Header band
  p.push('<tr><td style="height:8px;background:' + brandColor + ';font-size:0;line-height:0;">&nbsp;</td></tr>');

  // [2] Logo + brand row
  p.push('<tr><td style="background:#ffffff;padding:28px 32px;">');
  p.push('<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>');
  p.push('<td style="vertical-align:middle;">');
  if (logoUrl) p.push(logoHtml);
  p.push('<span style="font-size:18px;font-weight:700;color:#000000;vertical-align:middle;' + (logoUrl ? "margin-left:10px;" : "") + '">' + brandName + "</span>");
  p.push("</td>");
  p.push('<td align="right" style="vertical-align:middle;"><span style="font-size:12px;color:#666666;">Credit Analysis Report</span></td>');
  p.push("</tr></table>");
  p.push("</td></tr>");

  // [3] Greeting
  p.push('<tr><td style="padding:0 32px 20px;">');
  p.push('<p style="font-size:20px;font-weight:700;color:#111111;margin:0 0 10px;">Hi ' + firstName + ",</p>");
  p.push('<p style="font-size:14px;color:#444444;margin:0;line-height:1.6;">' + emailIntro + "</p>");
  p.push("</td></tr>");

  // [4] Score hero box
  p.push('<tr><td style="padding:0 32px 16px;">');
  p.push('<div style="border-left:4px solid ' + brandColor + ';background:' + brandColorAlpha8 + ';border-radius:8px;padding:20px;">');
  p.push('<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>');
  p.push('<td style="vertical-align:middle;">');
  p.push('<div style="font-size:48px;font-weight:700;color:' + brandColor + ';line-height:1;">' + score + "/10</div>");
  p.push('<div style="font-size:12px;color:#666666;margin-top:4px;">Funding Readiness Score</div>');
  p.push("</td>");
  p.push('<td align="right" style="vertical-align:middle;">');
  p.push('<div style="font-size:16px;font-weight:700;color:#111111;margin-bottom:4px;">Avg FICO: ' + avgScore + "</div>");
  p.push('<div style="font-size:14px;color:' + brandColor + ';">Est. Funding: ' + estimatedFunding + "</div>");
  p.push("</td>");
  p.push("</tr></table>");
  p.push("</div>");
  p.push("</td></tr>");

  // [5] Bureau scores
  p.push('<tr><td style="padding:0 32px 16px;">');
  p.push('<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>');
  for (var bi = 0; bi < bureauList.length; bi++) {
    if (bi > 0) p.push('<td style="width:8px;"></td>');
    var b = bureauList[bi];
    var bColor = bureauScoreColor(b.score, brandColor);
    p.push('<td style="border:1px solid #eeeeee;border-radius:6px;padding:12px;text-align:center;">');
    p.push('<div style="font-size:11px;text-transform:uppercase;color:#999999;letter-spacing:0.05em;margin-bottom:4px;">' + b.name + "</div>");
    p.push('<div style="font-size:20px;font-weight:700;color:' + bColor + ';">' + (b.score || "—") + "</div>");
    p.push("</td>");
  }
  p.push("</tr></table>");
  p.push("</td></tr>");

  // [6] Divider
  p.push('<tr><td style="padding:0 32px;"><div style="height:1px;background:#eeeeee;"></div></td></tr>');

  // [7] Strengths
  if (passed.length > 0) {
    p.push('<tr><td style="padding:20px 32px 0;">');
    p.push('<p style="font-size:14px;font-weight:700;color:' + brandColor + ';margin:0 0 10px;">&#x2713; What You’re Doing Right</p>');
    for (var pi = 0; pi < passed.length; pi++) {
      p.push('<div style="font-size:13px;color:#333333;margin-bottom:6px;line-height:1.5;"><span style="color:#4caf50;font-weight:700;margin-right:6px;">&#x2713;</span>' + (passed[pi].label || passed[pi].name || "") + "</div>");
    }
    p.push("</td></tr>");
  }

  // [8] Areas to improve
  if (failed.length > 0) {
    p.push('<tr><td style="padding:12px 32px 0;">');
    p.push('<p style="font-size:14px;font-weight:700;color:#e53935;margin:0 0 10px;">Areas to Improve</p>');
    for (var fi = 0; fi < failed.length; fi++) {
      p.push('<div style="font-size:13px;color:#333333;margin-bottom:6px;line-height:1.5;"><span style="color:#f44336;font-weight:700;margin-right:6px;">&#x2717;</span>' + (failed[fi].label || failed[fi].name || "") + "</div>");
    }
    p.push("</td></tr>");
  }

  // [9] Priority actions
  if (actions.length > 0) {
    p.push('<tr><td style="padding:16px 32px;">');
    p.push('<p style="font-size:14px;font-weight:700;color:#333333;margin:0 0 10px;">Your Top Priority Actions</p>');
    for (var ai = 0; ai < actions.length; ai++) {
      p.push('<div style="font-size:13px;color:#555555;margin-bottom:8px;line-height:1.5;">' + (ai + 1) + ". " + actions[ai] + "</div>");
    }
    p.push("</td></tr>");
  }

  // [10] CTA button
  if (ctaEnabled) {
    p.push('<tr><td style="text-align:center;padding:24px 32px;">');
    p.push('<a href="' + ctaUrl + '" style="display:inline-block;padding:14px 32px;background:' + brandColor + ';color:#000000;text-decoration:none;border-radius:6px;font-size:15px;font-weight:700;">' + ctaText + "</a>");
    p.push("</td></tr>");
  }

  // [11] View full report button
  p.push('<tr><td style="text-align:center;padding:' + (ctaEnabled ? "8px" : "24px") + ' 32px 24px;">');
  p.push('<a href="' + analysisUrl + '" style="display:inline-block;padding:12px 28px;border:2px solid ' + brandColor + ';color:' + brandColor + ';background:transparent;text-decoration:none;border-radius:6px;font-size:14px;">View Full Interactive Report &rarr;</a>');
  p.push("</td></tr>");

  // [12] Divider
  p.push('<tr><td style="padding:0 32px;"><div style="height:1px;background:#eeeeee;"></div></td></tr>');

  // [13] Footer
  p.push('<tr><td style="background:#f8f8f8;padding:24px 32px;font-size:12px;color:#888888;">');
  p.push('<div style="margin-bottom:8px;">' + footerLogoHtml + '<strong style="color:#333333;">' + brandName + "</strong></div>");
  if (ceoName) p.push('<div style="margin-bottom:4px;">' + ceoName + "</div>");
  if (ownerEmail) p.push('<div style="margin-bottom:4px;"><a href="mailto:' + ownerEmail + '" style="color:#888888;text-decoration:none;">' + ownerEmail + "</a></div>");
  if (websiteUrl) p.push('<div style="margin-bottom:4px;"><a href="' + websiteUrl + '" style="color:#888888;text-decoration:none;">' + websiteUrl + "</a></div>");
  p.push('<div style="height:1px;background:#dddddd;margin:12px 0;"></div>');
  p.push('<div style="margin-bottom:4px;">This report was prepared exclusively for ' + firstName + " " + lastName + ".</div>");
  p.push('<div style="color:#bbbbbb;">Powered by CreditScore Pro&#8482;</div>');
  p.push("</td></tr>");

  // [14] Bottom band
  p.push('<tr><td style="height:4px;background:' + brandColor + ';font-size:0;line-height:0;">&nbsp;</td></tr>');

  p.push("</table>");
  p.push("</td></tr>");
  p.push("</table>");
  p.push("</body></html>");

  return p.join("\n");
}

export function buildCustomEmail({ contactData, analysisUrl, tenantBranding, stepConfig }) {
  var branding = tenantBranding || {};
  var step = stepConfig || {};

  var brandName = branding.brand_name || "CreditScore Pro";
  var brandColor = safeBrandColor(branding.brand_color);
  var logoUrl = branding.logo_url || "";
  var websiteUrl = branding.website || "";
  var ceoName = branding.ceo_name || "";
  var ownerEmail = branding.owner_email || "";

  var firstName = (contactData && contactData.firstName) || "there";

  var emailBody = step.email_body ||
    "We wanted to follow up regarding your recent credit analysis. Please reach out if you have any questions about your results.";
  var ctaEnabled = step.cta_enabled && step.cta_url;
  var ctaText = step.cta_text || "Book a Free Consultation";
  var ctaUrl = step.cta_url || "";

  var logoHtml = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + brandName + '" style="height:40px;max-width:160px;display:inline-block;vertical-align:middle;" />'
    : "";

  var footerLogoHtml = logoUrl
    ? '<img src="' + logoUrl + '" alt="' + brandName + '" style="height:24px;vertical-align:middle;margin-right:8px;" />'
    : "";

  // Convert body to HTML paragraphs
  var bodyHtml = emailBody.split(/\n\n+/).map(function (block) {
    var trimmed = block.trim();
    if (!trimmed) return "";
    return '<p style="font-size:14px;color:#444444;margin:0 0 14px;line-height:1.7;">' + trimmed.replace(/\n/g, "<br>") + "</p>";
  }).filter(Boolean).join("\n");

  var p = [];

  p.push("<!DOCTYPE html>");
  p.push("<html>");
  p.push('<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>');
  p.push('<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">');

  p.push('<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:24px 0;">');
  p.push("<tr><td align=\"center\">");
  p.push('<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;margin:0 auto;">');

  // [1] Header band
  p.push('<tr><td style="height:8px;background:' + brandColor + ';font-size:0;line-height:0;">&nbsp;</td></tr>');

  // [2] Logo + brand
  p.push('<tr><td style="background:#ffffff;padding:24px 32px;">');
  if (logoUrl) p.push(logoHtml);
  p.push('<span style="font-size:16px;font-weight:700;color:#000000;' + (logoUrl ? "margin-left:8px;" : "") + 'vertical-align:middle;">' + brandName + "</span>");
  p.push("</td></tr>");

  // [3] Greeting + body
  p.push('<tr><td style="padding:0 32px 20px;">');
  p.push('<p style="font-size:16px;font-weight:600;color:#111111;margin:0 0 16px;">Hi ' + firstName + ",</p>");
  p.push(bodyHtml);
  p.push("</td></tr>");

  // [4] CTA button
  if (ctaEnabled) {
    p.push('<tr><td style="text-align:center;padding:8px 32px 16px;">');
    p.push('<a href="' + ctaUrl + '" style="display:inline-block;padding:14px 32px;background:' + brandColor + ';color:#000000;text-decoration:none;border-radius:6px;font-size:15px;font-weight:700;">' + ctaText + "</a>");
    p.push("</td></tr>");
  }

  // [5] Report link
  p.push('<tr><td style="text-align:center;padding:8px 32px 24px;">');
  p.push('<a href="' + analysisUrl + '" style="font-size:14px;color:' + brandColor + ';text-decoration:underline;">View your credit report &rarr;</a>');
  p.push("</td></tr>");

  // Footer
  p.push('<tr><td style="background:#f8f8f8;padding:24px 32px;font-size:12px;color:#888888;">');
  p.push('<div style="margin-bottom:8px;">' + footerLogoHtml + '<strong style="color:#333333;">' + brandName + "</strong></div>");
  if (ceoName) p.push('<div style="margin-bottom:4px;">' + ceoName + "</div>");
  if (ownerEmail) p.push('<div style="margin-bottom:4px;"><a href="mailto:' + ownerEmail + '" style="color:#888888;text-decoration:none;">' + ownerEmail + "</a></div>");
  if (websiteUrl) p.push('<div style="margin-bottom:4px;"><a href="' + websiteUrl + '" style="color:#888888;text-decoration:none;">' + websiteUrl + "</a></div>");
  p.push('<div style="height:1px;background:#dddddd;margin:12px 0;"></div>');
  p.push('<div style="color:#bbbbbb;">Powered by CreditScore Pro&#8482;</div>');
  p.push("</td></tr>");

  // Bottom band
  p.push('<tr><td style="height:4px;background:' + brandColor + ';font-size:0;line-height:0;">&nbsp;</td></tr>');

  p.push("</table>");
  p.push("</td></tr>");
  p.push("</table>");
  p.push("</body></html>");

  return p.join("\n");
}

export function buildSmsMessage({ template, contactData, score, url, ctaEnabled, ctaText, ctaUrl }) {
  var firstName = (contactData && contactData.firstName) || "there";
  var lastName = (contactData && contactData.lastName) || "";
  var scoreStr = String(score || 0);
  var ctaLine = (ctaEnabled && ctaUrl) ? ("\n" + (ctaText || "Learn more") + ": " + ctaUrl) : "";

  var defaultTemplate = "Hi [firstName]! Your credit analysis report is ready. Score: [score]/10.\nView full report: [url][ctaLine]";
  var tmpl = template || defaultTemplate;

  return tmpl
    .replace(/\[firstName\]/g, firstName)
    .replace(/\[lastName\]/g, lastName)
    .replace(/\[score\]/g, scoreStr)
    .replace(/\[url\]/g, url || "")
    .replace(/\[cta_url\]/g, ctaUrl || "")
    .replace(/\[ctaLine\]/g, ctaLine);
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────

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
