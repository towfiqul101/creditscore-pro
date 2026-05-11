import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request) {
  var url = new URL(request.url);
  var code = url.searchParams.get("code");
  var next = url.searchParams.get("next") || "/dashboard";

  if (code) {
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

    var result = await supabase.auth.exchangeCodeForSession(code);
    if (!result.error) {
      return NextResponse.redirect(url.origin + next);
    }
  }

  return NextResponse.redirect(url.origin + "/login?error=auth_failed");
}
