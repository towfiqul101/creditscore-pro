import { NextResponse } from "next/server";
import { analyzeCredit } from "@/lib/analysis";
import { createAdminClient } from "@/lib/supabase-server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData, userId, tenantId } = body;

    // Step 1: Run local rule-based analysis
    const analysis = analyzeCredit(formData);

    // Step 2: Enhance with Groq AI (free)
    const aiEnhanced = await enhanceWithGroq(analysis, formData);

    // Step 3: Merge AI insights
    const finalAnalysis = {
      ...analysis,
      results: analysis.results.map((r, i) => ({
        ...r,
        aiInsight: aiEnhanced.insights?.[i] || null,
      })),
      summary: aiEnhanced.summary || `Your funding readiness score is ${analysis.score}/10 (${analysis.percentage}%). Average FICO 8 is ${analysis.avgScore}.`,
      priorityActions: aiEnhanced.priorityActions || analysis.results.filter(r => !r.passed).slice(0, 3).map(r => r.action),
    };

    // Step 4: Save to database
    const supabase = createAdminClient();
    const { data: savedAnalysis, error: dbError } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        tenant_id: tenantId || null,
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
      return NextResponse.json({
        success: true,
        analysis: finalAnalysis,
        id: null,
        dbError: dbError.message,
      });
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

async function enhanceWithGroq(analysis, formData) {
  try {
    const prompt = `You are a credit analysis expert. A client has these results:

FICO Scores: TransUnion ${formData.scoreTU}, Experian ${formData.scoreEX}, Equifax ${formData.scoreEQ}
Utilization: ${formData.utilization}%, Primary Accounts: ${formData.primaryAccounts}
Credit Age: ${formData.creditAge} years, Late Payments: ${formData.latePayments}
Negative Items: ${formData.negativeItems}, Highest Limit: $${formData.highestLimit}
Inquiries: ${formData.inquiries}, Personal Info Correct: ${formData.personalInfo}
Errors: ${formData.errors}

Funding Readiness: ${analysis.score}/10, Estimated Funding: ${analysis.estimatedFunding}

Provide a JSON response with:
1. "summary": 2-3 sentence personalized summary
2. "priorityActions": top 3 actions as array of strings
3. "insights": array of 10 brief insights (1 sentence each for each criteria)

Respond ONLY with valid JSON, no markdown.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Groq AI error:", error);
    return { summary: null, priorityActions: [], insights: [] };
  }
}