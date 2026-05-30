import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendAnalysisResults } from "@/lib/ghl";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(request) {
  try {
    var cookieStore = cookies();
    var supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: function() { return cookieStore.getAll(); },
          setAll: function(cookiesToSet) {
            cookiesToSet.forEach(function(item) {
              cookieStore.set(item.name, item.value, item.options);
            });
          },
        },
      }
    );

    var authResult = await supabase.auth.getUser();
    if (!authResult.data || !authResult.data.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    var userId = authResult.data.user.id;

    var body = await request.json();
    var analysisId = body.analysisId;
    var sendSms = body.sendSms !== false;
    var sendEmail = body.sendEmail !== false;

    if (!analysisId) {
      return NextResponse.json({ success: false, error: "analysisId required" }, { status: 400 });
    }

    var admin = createAdminClient();

    var memberRes = await admin
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (!memberRes.data) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }
    var tenantId = memberRes.data.tenant_id;

    var analysisRes = await admin
      .from("analyses")
      .select("id, ghl_contact_id, contact_first_name, contact_last_name, contact_email, contact_phone, funding_score, estimated_funding, score_avg")
      .eq("id", analysisId)
      .eq("tenant_id", tenantId)
      .single();

    if (analysisRes.error || !analysisRes.data) {
      return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 });
    }
    var analysis = analysisRes.data;

    if (!analysis.ghl_contact_id) {
      return NextResponse.json({ success: false, error: "This client hasn't been synced to GHL yet" }, { status: 400 });
    }

    var tenantRes = await admin
      .from("tenants")
      .select("ghl_api_key, ghl_location_id, ghl_enabled, brand_name, brand_color, logo_url, owner_email, website, ceo_name, results_sms_template, results_email_subject")
      .eq("id", tenantId)
      .single();

    if (tenantRes.error || !tenantRes.data) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    var tenant = tenantRes.data;

    if (!tenant.ghl_enabled || !tenant.ghl_api_key || !tenant.ghl_location_id) {
      return NextResponse.json({ success: false, error: "GHL is not configured" }, { status: 400 });
    }

    var appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://creditscore-pro.vercel.app";
    var analysisUrl = appUrl + "/results/" + analysisId;

    var sendResult = await sendAnalysisResults({
      ghlApiKey: tenant.ghl_api_key,
      locationId: tenant.ghl_location_id,
      contactId: analysis.ghl_contact_id,
      contactData: {
        firstName: analysis.contact_first_name,
        lastName: analysis.contact_last_name,
        email: analysis.contact_email,
        phone: analysis.contact_phone,
      },
      analysisUrl: analysisUrl,
      analysisData: {
        score: analysis.funding_score,
        estimatedFunding: analysis.estimated_funding,
        avgScore: analysis.score_avg,
      },
      sendSms: sendSms,
      sendEmail: sendEmail,
      smsTemplate: tenant.results_sms_template,
      emailSubject: tenant.results_email_subject,
      tenantBranding: {
        brand_name: tenant.brand_name,
        brand_color: tenant.brand_color,
        logo_url: tenant.logo_url,
        owner_email: tenant.owner_email,
        website: tenant.website,
        ceo_name: tenant.ceo_name,
      },
    });

    var anythingSent = sendResult.smsSent || sendResult.emailSent;
    var hasError = sendResult.smsError || sendResult.emailError;
    return NextResponse.json({
      success: anythingSent,
      smsSent: sendResult.smsSent,
      emailSent: sendResult.emailSent,
      smsError: sendResult.smsError,
      emailError: sendResult.emailError,
      error: !anythingSent && hasError
        ? (sendResult.emailError || sendResult.smsError)
        : null,
    });

  } catch (err) {
    console.error("send-now error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
