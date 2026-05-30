import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildFullResultsEmail, buildCustomEmail } from "@/lib/ghl";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

var SAMPLE_CONTACT = {
  firstName: "John",
  lastName: "Smith",
  email: "john@example.com",
  phone: "+15550001234",
};

var SAMPLE_ANALYSIS = {
  score: 7,
  avgScore: 698,
  estimatedFunding: "$25K–$75K",
  bureauScores: {
    TransUnion: 705,
    Experian: 692,
    Equifax: 698,
  },
  results: [
    { passed: true, label: "Credit score meets minimum threshold" },
    { passed: true, label: "No late payments in the last 24 months" },
    { passed: true, label: "Personal information accurate across bureaus" },
    { passed: true, label: "Highest credit card limit above $5,000" },
    { passed: false, label: "Credit utilization below 30%" },
    { passed: false, label: "Sufficient primary accounts (4+)" },
    { passed: false, label: "Credit age 5+ years" },
    { passed: false, label: "No negative items on report" },
    { passed: false, label: "Fewer than 3 inquiries per bureau" },
    { passed: false, label: "No report errors found" },
  ],
  priorityActions: [
    "Pay down credit card balances to bring utilization below 30%",
    "Dispute any errors on your credit reports at all three bureaus",
    "Open one additional primary tradeline to strengthen your credit mix",
  ],
};

export async function GET(request) {
  var supabase = createAdminClient();

  var url = new URL(request.url);
  var stepId = url.searchParams.get("stepId");
  var tenantId = url.searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  // Fetch tenant branding
  var tenantRes = await supabase
    .from("tenants")
    .select("brand_name, brand_color, logo_url, owner_email, website, ceo_name")
    .eq("id", tenantId)
    .single();

  if (tenantRes.error || !tenantRes.data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  var tenantBranding = tenantRes.data;
  var appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://creditscore-pro.vercel.app";
  var sampleUrl = appUrl + "/results/sample";

  var emailType = "full_results";
  var stepConfig = {};

  if (stepId) {
    var stepRes = await supabase
      .from("notification_steps")
      .select("*")
      .eq("id", stepId)
      .single();

    if (!stepRes.error && stepRes.data) {
      var step = stepRes.data;
      emailType = step.email_type || "full_results";
      stepConfig = {
        email_intro: step.email_intro,
        email_body: step.email_body,
        cta_enabled: step.cta_enabled,
        cta_text: step.cta_text,
        cta_url: step.cta_url,
        sms_template: step.sms_template,
      };
    }
  }

  var html;
  if (emailType === "full_results") {
    html = buildFullResultsEmail({
      contactData: SAMPLE_CONTACT,
      analysisData: SAMPLE_ANALYSIS,
      analysisUrl: sampleUrl,
      tenantBranding: tenantBranding,
      stepConfig: stepConfig,
    });
  } else {
    html = buildCustomEmail({
      contactData: SAMPLE_CONTACT,
      analysisUrl: sampleUrl,
      tenantBranding: tenantBranding,
      stepConfig: stepConfig,
    });
  }

  return NextResponse.json({ html: html });
}
