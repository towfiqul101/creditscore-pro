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
    .select("*, tenants(ghl_api_key, ghl_location_id, ghl_enabled, brand_name, brand_color, logo_url, owner_email, website, ceo_name)")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .lt("attempts", 3)
    .limit(20);

  var items = queueRes.data || [];
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var tenant = item.tenants;

    await supabase
      .from("notification_queue")
      .update({ attempts: item.attempts + 1 })
      .eq("id", item.id);

    try {
      if (!tenant || !tenant.ghl_enabled || !tenant.ghl_api_key) {
        throw new Error("GHL not configured for tenant");
      }

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
        analysisResults: {
          score: item.funding_score,
          estimatedFunding: item.estimated_funding,
        },
        sendSms: item.send_sms,
        sendEmail: item.send_email,
        smsTemplate: item.sms_template,
        emailSubject: item.email_subject,
        tenantBranding: {
          brand_name: tenant.brand_name,
          brand_color: tenant.brand_color,
          logo_url: tenant.logo_url,
          owner_email: tenant.owner_email,
          website: tenant.website,
          ceo_name: tenant.ceo_name,
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
