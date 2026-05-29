import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

    var body = await request.json();
    var apiKey = body.apiKey;
    var locationId = body.locationId;

    if (!apiKey || !locationId) {
      return NextResponse.json({ success: false, error: "apiKey and locationId are required" }, { status: 400 });
    }

    var res = await fetch(
      "https://services.leadconnectorhq.com/contacts/?locationId=" + locationId + "&limit=1",
      {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Version": "2021-07-28",
        },
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ success: false, error: "Invalid API key" });
      } else if (res.status === 403) {
        return NextResponse.json({ success: false, error: "Missing permissions — check integration scopes" });
      } else {
        return NextResponse.json({ success: false, error: "Connection failed (status " + res.status + ")" });
      }
    }

    // Also test Conversations scope
    var convRes = await fetch(
      "https://services.leadconnectorhq.com/conversations/search?locationId=" + locationId + "&limit=1",
      {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Version": "2021-07-28",
        },
      }
    );

    if (convRes.ok) {
      return NextResponse.json({ success: true, message: "Connected — Contacts ✓ Conversations ✓" });
    } else {
      return NextResponse.json({
        success: true,
        partial: true,
        message: "Contacts ✓ but Conversations ✗ — enable Conversations scope in your GHL integration for SMS/email sending",
      });
    }
  } catch (err) {
    console.error("test-ghl error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
