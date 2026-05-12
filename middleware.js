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

  // Refresh session — this is required to keep cookies alive
  var userResult = await supabase.auth.getUser();
  var user = userResult.data.user;

  var path = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected pages
  if (!user && (path.startsWith("/dashboard") || path.startsWith("/analysis"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect logged-in users away from login/signup
  if (user && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/analysis/:path*", "/login", "/signup"],
};
