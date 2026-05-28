import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request) {
  var url = new URL(request.url);
  var code = url.searchParams.get("code");

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
      var user = result.data && result.data.session && result.data.session.user;
      if (user) {
        var profileRes = await supabase
          .from("profiles")
          .select("company_name")
          .eq("id", user.id)
          .single();

        var hasCompany = profileRes.data && profileRes.data.company_name;
        if (!hasCompany) {
          return NextResponse.redirect(url.origin + "/onboarding");
        }
      }
      return NextResponse.redirect(url.origin + "/dashboard");
    }
  }

  return NextResponse.redirect(url.origin + "/login?error=auth_failed");
}
