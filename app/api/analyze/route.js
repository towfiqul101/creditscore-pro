import { NextResponse } from "next/server";
import OpenAI from "openai";
import { analyzeCredit } from "@/lib/analysis";
import { createAdminClient } from "@/lib/supabase-server";
import { syncToGHL } from "@/lib/ghl";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData, userId, tenantId } = body;

    // Step 1: Run local rule-based analysis
    const analysis = analyzeCredit(formData);

    // Step 2: Enhance with AI for personalized recommendations
    const aiEnhanced = await enhanceWithAI(analysis, formData);

    // Step 3: Merge AI insights into results
    const finalAnalysis = {
      ...analysis,
      results: analysis.results.map((r, i) => ({
        ...r,
        aiInsight: aiEnhanced.insights?.[i] || null,
      })),
      summary: aiEnhanced.summary || null,
      priorityActions: aiEnhanced.priorityActions || [],
    };

    // Step 4: Save to database
    const supabase = createAdminClient();
    const { data: savedAnalysis, error: dbError } = await supabase
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
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB save error:", dbError);
    }

    // Step 5: Sync to GHL if tenant has it configured
    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("ghl_api_key, ghl_location_id")
        .eq("id", tenantId)
        .single();

      if (tenant?.ghl_api_key && tenant?.ghl_location_id) {
        const ghlResult = await syncToGHL({
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
      }
    }

    return NextResponse.json({
      success: true,
      analysis: finalAnalysis,
      id: savedAnalysis?.id || null,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function enhanceWithAI(analysis, formData) {
  try {
    const prompt = `You are a credit analysis expert. A client has completed a credit analysis with these results:

FICO Scores: TransUnion ${formData.scoreTU}, Experian ${formData.scoreEX}, Equifax ${formData.scoreEQ}
Utilization: ${formData.utilization}%
Primary Accounts: ${formData.primaryAccounts}
Credit Age: ${formData.creditAge} years
Late Payments (24mo): ${formData.latePayments}
Negative Items: ${formData.negativeItems}
Highest Card Limit: $${formData.highestLimit}
Inquiries per Bureau: ${formData.inquiries}
Personal Info Correct: ${formData.personalInfo}
Report Errors: ${formData.errors}

Funding Readiness Score: ${analysis.score}/10
Estimated Funding: ${analysis.estimatedFunding}

Provide:
1. A 2-3 sentence personalized summary of their credit standing and funding potential
2. Top 3 priority actions they should take RIGHT NOW, in order of impact
3. For each of the 10 criteria, provide a brief personalized insight (1 sentence each)

Respond in JSON format:
{
  "summary": "...",
  "priorityActions": ["action1", "action2", "action3"],
  "insights": ["insight for criteria 1", "insight for criteria 2", ..., "insight for criteria 10"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("AI enhancement error:", error);
    return { summary: null, priorityActions: [], insights: [] };
  }
}
