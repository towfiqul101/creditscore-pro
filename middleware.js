import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  var response = NextResponse.next({
    request: { headers: request.headers },
  });

  var supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: function () {
          return request.cookies.getAll();
        },
        setAll: function (cookiesToSet) {
          cookiesToSet.forEach(function (item) {
            request.cookies.set(item.name, item.value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(function (item) {
            response.cookies.set(item.name, item.value, item.options);
          });
        },
      },
    }
  );

  var sessionResult = await supabase.auth.getSession();
  var session = sessionResult.data.session;

  var path = request.nextUrl.pathname;

  var protectedPaths = path.startsWith("/dashboard") || path.startsWith("/analysis") ||
    path.startsWith("/tenant") || path === "/onboarding";

  if (!session && protectedPaths) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/analysis/:path*",
    "/tenant/:path*",
    "/onboarding",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
