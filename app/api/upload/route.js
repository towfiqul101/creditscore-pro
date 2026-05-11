import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    var formData = await request.formData();
    var file = formData.get("file");

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    var validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (validTypes.indexOf(file.type) === -1) {
      return NextResponse.json({ success: false, error: "Please upload a PDF or image file" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File must be under 20MB" }, { status: 400 });
    }

    var extractedData;

    if (file.type === "application/pdf") {
      var pdfParse = require("pdf-parse");
      var buffer = Buffer.from(await file.arrayBuffer());
      var pdfData = await pdfParse(buffer);

      if (!pdfData.text || pdfData.text.trim().length < 50) {
        return NextResponse.json({
          success: false,
          error: "Could not extract text from this PDF. It may be image-based. Please use manual entry instead."
        }, { status: 400 });
      }

      extractedData = await parseWithGroq(pdfData.text);
    } else {
      return NextResponse.json({
        success: false,
        error: "Image upload requires OpenAI Vision API (coming soon). Please use manual entry or upload a text-based PDF."
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      extractedData: extractedData,
    });
  } catch (error) {
    console.error("Upload parse error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function parseWithGroq(pdfText) {
  var trimmedText = pdfText.substring(0, 12000);

  var prompt = "You are a credit report parsing expert. Extract the following data from this trimerge credit report text.\n\n" +
    "EXTRACT THESE FIELDS:\n" +
    "- scoreTU: TransUnion FICO 8 score (number)\n" +
    "- scoreEX: Experian FICO 8 score (number)\n" +
    "- scoreEQ: Equifax FICO 8 score (number)\n" +
    "- personalInfo: \"yes\" if name/address/SSN appear consistent, \"no\" if discrepancies found\n" +
    "- errors: number of obvious reporting errors (0 if none visible)\n" +
    "- utilization: highest utilization percentage on any single card (number, 0-100)\n" +
    "- primaryAccounts: count of open primary tradelines (number)\n" +
    "- creditAge: average age of all accounts in years (number, can be decimal)\n" +
    "- latePayments: count of late payments in last 24 months (number)\n" +
    "- negativeItems: count of collections, charge-offs, bankruptcies, public records (number)\n" +
    "- highestLimit: highest credit card limit in dollars (number, no $ or commas)\n" +
    "- inquiries: maximum hard inquiries on any single bureau in last 24 months (number)\n" +
    "- firstName: client first name if visible\n" +
    "- lastName: client last name if visible\n\n" +
    "Respond ONLY with valid JSON, no markdown, no explanation.\n" +
    "If a value cannot be determined, use 0 for numbers and \"yes\" for personalInfo.\n\n" +
    "CREDIT REPORT TEXT:\n" + trimmedText;

  var res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.GROQ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  var data = await res.json();

  if (!data.choices || !data.choices[0]) {
    console.error("Groq PDF parse error:", JSON.stringify(data));
    throw new Error("AI could not parse the credit report. Please use manual entry.");
  }

  var content = data.choices[0].message.content;
  return JSON.parse(content);
}
