import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Please upload a PDF or image file" }, { status: 400 });
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File must be under 20MB" }, { status: 400 });
    }

    let extractedData;

    if (file.type === "application/pdf") {
      // Parse PDF using pdf-parse
      const pdfParse = require("pdf-parse");
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await pdfParse(buffer);
      extractedData = await parseWithAI(pdfData.text);
    } else {
      // For images, use GPT-4o vision to read the credit report
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mimeType = file.type;
      extractedData = await parseImageWithAI(base64, mimeType);
    }

    return NextResponse.json({
      success: true,
      extractedData,
    });
  } catch (error) {
    console.error("Upload parse error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function parseWithAI(pdfText) {
  const prompt = `You are a credit report parsing expert. Extract the following data from this trimerge credit report text. 

EXTRACT THESE FIELDS:
- scoreTU: TransUnion FICO 8 score (number)
- scoreEX: Experian FICO 8 score (number)
- scoreEQ: Equifax FICO 8 score (number)
- personalInfo: "yes" if name/address/SSN appear consistent, "no" if discrepancies found
- errors: number of obvious reporting errors (0 if none visible)
- utilization: highest utilization percentage on any single card (number, 0-100)
- primaryAccounts: count of open primary tradelines (number)
- creditAge: average age of all accounts in years (number, can be decimal)
- latePayments: count of late payments in last 24 months (number)
- negativeItems: count of collections, charge-offs, bankruptcies, public records (number)
- highestLimit: highest credit card limit in dollars (number, no $ or commas)
- inquiries: maximum hard inquiries on any single bureau in last 24 months (number)

Also extract if available:
- firstName: client first name
- lastName: client last name

Respond ONLY in JSON format with these exact field names. If a value cannot be determined, use a reasonable estimate based on the available data, or 0 for numbers and "yes" for personalInfo.

CREDIT REPORT TEXT:
${pdfText.substring(0, 15000)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  return JSON.parse(content);
}

async function parseImageWithAI(base64Image, mimeType) {
  const prompt = `You are a credit report parsing expert. This is an image of a credit report. Extract the following data:

- scoreTU: TransUnion FICO 8 score (number)
- scoreEX: Experian FICO 8 score (number)  
- scoreEQ: Equifax FICO 8 score (number)
- personalInfo: "yes" if info appears consistent, "no" if issues visible
- errors: number of obvious errors (0 if none)
- utilization: highest utilization % on any card (number)
- primaryAccounts: count of open primary accounts (number)
- creditAge: average account age in years (number)
- latePayments: late payments in last 24 months (number)
- negativeItems: collections, charge-offs, bankruptcies count (number)
- highestLimit: highest card limit in dollars (number)
- inquiries: max hard inquiries on any bureau (number)
- firstName: client first name if visible
- lastName: client last name if visible

Respond ONLY in JSON format. If a value can't be determined, use 0 for numbers and "yes" for personalInfo.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  return JSON.parse(content);
}
