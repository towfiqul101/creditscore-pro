import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAnalysisResults } from "@/lib/ghl";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function GET(request) {
  var authHeader = request.headers.get("authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  var supabase = createAdminClient();
  var now = new Date().toISOString();

  var queueRes = await supabase
    .from("notification_queue")
    .select(
      "*, " +
      "tenants(ghl_api_key, ghl_location_id, ghl_enabled, brand_name, brand_color, logo_url, owner_email, website, ceo_name), " +
      "analyses(funding_score, score_avg, estimated_funding, score_tu, score_ex, score_eq, results, summary, priority_actions)"
    )
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .lt("attempts", 3)
    .limit(20);

  var items = queueRes.data || [];
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var tenant = item.tenants;
    var analysis = item.analyses;

    await supabase
      .from("notification_queue")
      .update({ attempts: item.attempts + 1 })
      .eq("id", item.id);

    try {
      if (!tenant || !tenant.ghl_enabled || !tenant.ghl_api_key) {
        throw new Error("GHL not configured for tenant");
      }

      var analysisData = analysis
        ? {
            score: analysis.funding_score,
            avgScore: analysis.score_avg,
            estimatedFunding: analysis.estimated_funding,
            bureauScores: {
              TransUnion: analysis.score_tu,
              Experian: analysis.score_ex,
              Equifax: analysis.score_eq,
            },
            results: analysis.results || [],
            priorityActions: analysis.priority_actions || [],
          }
        : {
            score: item.funding_score,
            estimatedFunding: item.estimated_funding,
            bureauScores: {},
            results: [],
            priorityActions: [],
          };

      var sendResult = await sendAnalysisResults({
        ghlApiKey: tenant.ghl_api_key,
        locationId: tenant.ghl_location_id,
        contactId: item.contact_id,
        contactData: {
          firstName: item.contact_first_name,
          lastName: item.contact_last_name,
          email: item.contact_email,
          phone: item.contact_phone,
        },
        analysisUrl: item.results_url,
        analysisData: analysisData,
        sendSms: item.send_sms,
        sendEmail: item.send_email,
        emailType: item.email_type || "full_results",
        emailSubject: item.email_subject,
        tenantBranding: {
          brand_name: tenant.brand_name,
          brand_color: tenant.brand_color,
          logo_url: tenant.logo_url,
          owner_email: tenant.owner_email,
          website: tenant.website,
          ceo_name: tenant.ceo_name,
        },
        stepConfig: {
          email_intro: item.email_intro,
          email_body: item.email_body,
          cta_enabled: item.cta_enabled,
          cta_text: item.cta_text,
          cta_url: item.cta_url,
          sms_template: item.sms_template,
        },
      });

      await supabase
        .from("notification_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", item.id);

      results.push({ id: item.id, status: "sent", result: sendResult });

    } catch (err) {
      var isFinal = item.attempts + 1 >= 3;
      await supabase
        .from("notification_queue")
        .update({
          status: isFinal ? "failed" : "pending",
          last_error: err.message,
        })
        .eq("id", item.id);

      results.push({ id: item.id, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results: results });
}
