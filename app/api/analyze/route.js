import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeCredit } from "@/lib/analysis";
import { syncToGHL } from "@/lib/ghl";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(request) {
  try {
    var body = await request.json();
    var formData = body.formData;
    var userId = body.userId || null;
    var tenantId = body.tenantId || null;

    if (!formData) {
      return NextResponse.json({ success: false, error: "No form data provided" }, { status: 400 });
    }

    var supabase = createAdminClient();
    var currentAnalysesUsed = 0;
    var currentTenantAnalysesCount = 0;

    // Tenant monthly limit check
    if (tenantId) {
      var tenantLimitCheck = await supabase
        .from("tenants")
        .select("analyses_this_month, month_reset_date, analysis_limit")
        .eq("id", tenantId)
        .single();

      if (!tenantLimitCheck.error && tenantLimitCheck.data) {
        var tl = tenantLimitCheck.data;
        var tlNow = new Date();
        var tlResetDate = tl.month_reset_date ? new Date(tl.month_reset_date) : null;

        if (!tlResetDate || tlNow > tlResetDate) {
          var tlNext = new Date(tlNow.getFullYear(), tlNow.getMonth() + 1, 1);
          await supabase
            .from("tenants")
            .update({ analyses_this_month: 0, month_reset_date: tlNext.toISOString() })
            .eq("id", tenantId);
          tl.analyses_this_month = 0;
        }

        currentTenantAnalysesCount = tl.analyses_this_month || 0;
        var tenantLimit = tl.analysis_limit || 300;

        if (currentTenantAnalysesCount >= tenantLimit) {
          return NextResponse.json({ success: false, error: "TENANT_LIMIT_REACHED" }, { status: 403 });
        }
      }
    }

    // Free plan limit check
    if (userId) {
      var profileCheck = await supabase
        .from("profiles")
        .select("plan, analyses_used, analyses_reset_date")
        .eq("id", userId)
        .single();

      if (!profileCheck.error && profileCheck.data) {
        var prof = profileCheck.data;
        var now = new Date();
        var resetDate = prof.analyses_reset_date ? new Date(prof.analyses_reset_date) : null;

        if (!resetDate || now > resetDate) {
          var nextReset = new Date(now);
          nextReset.setMonth(nextReset.getMonth() + 1);
          await supabase
            .from("profiles")
            .update({ analyses_used: 0, analyses_reset_date: nextReset.toISOString() })
            .eq("id", userId);
          prof.analyses_used = 0;
        }

        currentAnalysesUsed = prof.analyses_used || 0;

        if (prof.plan === "free" && currentAnalysesUsed >= 3) {
          return NextResponse.json({ success: false, error: "LIMIT_REACHED" }, { status: 403 });
        }
      }
    }

    // Step 1: Run rule-based analysis
    var baseAnalysis = analyzeCredit(formData);

    // Step 2: Enhance with AI (Groq)
    var aiEnhanced = await enhanceWithAI(baseAnalysis, formData);

    var finalAnalysis = {
      score: baseAnalysis.score,
      total: baseAnalysis.total,
      percentage: baseAnalysis.percentage,
      avgScore: baseAnalysis.avgScore,
      estimatedFunding: baseAnalysis.estimatedFunding,
      bureauScores: baseAnalysis.bureauScores,
      analyzedAt: baseAnalysis.analyzedAt,
      results: baseAnalysis.results.map(function (r, i) {
        return Object.assign({}, r, { aiNote: aiEnhanced.notes ? (aiEnhanced.notes[i] || null) : null });
      }),
      summary: aiEnhanced.summary || null,
      priorityActions: aiEnhanced.priorityActions || [],
    };

    // Step 3: Save to database
    var dbResult = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        contact_first_name: formData.firstName,
        contact_last_name: formData.lastName,
        contact_email: formData.email,
        contact_phone: formData.phone,
        score_tu: +formData.scoreTU || 0,
        score_ex: +formData.scoreEX || 0,
        score_eq: +formData.scoreEQ || 0,
        score_avg: finalAnalysis.avgScore,
        funding_score: finalAnalysis.score,
        funding_percentage: finalAnalysis.percentage,
        estimated_funding: finalAnalysis.estimatedFunding,
        results: finalAnalysis.results,
        summary: finalAnalysis.summary,
        priority_actions: finalAnalysis.priorityActions,
        input_data: formData,
        ghl_synced: false,
        ghl_contact_id: null,
      })
      .select()
      .single();

    if (dbResult.error) {
      console.error("DB save error:", dbResult.error);
    }

    var savedAnalysisId = dbResult.data ? dbResult.data.id : null;

    // Increment analyses_used after successful save
    if (userId && savedAnalysisId) {
      await supabase
        .from("profiles")
        .update({ analyses_used: currentAnalysesUsed + 1 })
        .eq("id", userId);
    }

    // Increment tenant monthly counter
    if (tenantId && savedAnalysisId) {
      await supabase
        .from("tenants")
        .update({ analyses_this_month: currentTenantAnalysesCount + 1 })
        .eq("id", tenantId);
    }

    // Step 4: GHL sync — only if tenantId is present
    if (tenantId) {
      var tenantResult = await supabase
        .from("tenants")
        .select("ghl_api_key, ghl_location_id, ghl_enabled, name")
        .eq("id", tenantId)
        .single();

      var tenant = tenantResult.data;

      if (tenant && tenant.ghl_enabled && tenant.ghl_api_key && tenant.ghl_location_id) {
        var ghlResult = await syncToGHL({
          ghlApiKey: tenant.ghl_api_key,
          locationId: tenant.ghl_location_id,
          contactData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
          },
          analysisResults: finalAnalysis,
        });

        finalAnalysis.ghlSync = ghlResult;

        if (savedAnalysisId) {
          await supabase
            .from("analyses")
            .update({
              ghl_synced: ghlResult.success === true,
              ghl_contact_id: ghlResult.contactId || null,
            })
            .eq("id", savedAnalysisId);
        }

        if (!ghlResult.success) {
          console.error("GHL sync failed:", ghlResult.error);
        }
      } else if (tenant && !tenant.ghl_enabled) {
        console.log("GHL sync skipped — disabled for tenant:", tenant.name);
      } else if (!tenant) {
        console.error("Tenant not found for id:", tenantId);
      }
    }

    return NextResponse.json({
      success: true,
      analysis: finalAnalysis,
      id: savedAnalysisId,
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function enhanceWithAI(analysis, formData) {
  try {
    var prompt = "You are a credit analysis expert. A client has completed a credit analysis with these results:\n\n" +
      "FICO Scores: TransUnion " + formData.scoreTU + ", Experian " + formData.scoreEX + ", Equifax " + formData.scoreEQ + "\n" +
      "Utilization: " + formData.utilization + "%\n" +
      "Primary Accounts: " + formData.primaryAccounts + "\n" +
      "Credit Age: " + formData.creditAge + " years\n" +
      "Late Payments (24mo): " + formData.latePayments + "\n" +
      "Negative Items: " + formData.negativeItems + "\n" +
      "Highest Card Limit: $" + formData.highestLimit + "\n" +
      "Inquiries per Bureau: " + formData.inquiries + "\n" +
      "Personal Info Correct: " + formData.personalInfo + "\n" +
      "Report Errors: " + formData.errors + "\n\n" +
      "Funding Readiness Score: " + analysis.score + "/10\n" +
      "Estimated Funding: " + analysis.estimatedFunding + "\n\n" +
      "Criteria results:\n" +
      analysis.results.map(function (r) {
        return (r.passed ? "PASS" : "FAIL") + ": " + r.label;
      }).join("\n") +
      "\n\nRespond ONLY with a JSON object (no markdown, no backticks) in this format:\n" +
      '{"summary":"2-3 sentence overall assessment","priorityActions":["action 1","action 2","action 3"],"notes":["note for criterion 1","note for criterion 2","note for criterion 3","note for criterion 4","note for criterion 5","note for criterion 6","note for criterion 7","note for criterion 8","note for criterion 9","note for criterion 10"]}';

    var response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error("Groq API error: " + response.status);
    }

    var groqData = await response.json();
    var text = groqData.choices[0].message.content.trim();

    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    return JSON.parse(text);
  } catch (err) {
    console.error("AI enhancement error:", err);
    return { summary: null, priorityActions: [], notes: [] };
  }
}
