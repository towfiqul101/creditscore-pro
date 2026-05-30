import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function GET(request) {
  var cookieStore = cookies();
  var authClient = createServerClient(
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

  var userResult = await authClient.auth.getUser();
  if (!userResult.data || !userResult.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  var supabase = createAdminClient();

  var callerProfile = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.user.id)
    .single();

  if (!callerProfile.data || callerProfile.data.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all data in parallel via service role (bypasses RLS)
  var results = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, plan, company_name, whatsapp, created_at, analyses_used")
      .order("created_at", { ascending: false }),
    supabase
      .from("tenants")
      .select("id, name, slug, plan, ghl_enabled, owner_email, created_at, analyses_this_month")
      .order("created_at", { ascending: false }),
    supabase
      .from("analyses")
      .select("id, contact_first_name, contact_last_name, contact_email, funding_score, funding_percentage, estimated_funding, score_avg, ghl_synced, created_at, user_id, tenant_id")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  var profilesRes = results[0];
  var tenantsRes = results[1];
  var analysesRes = results[2];
  var authUsersRes = results[3];

  // Build email lookup from auth.users
  var emailMap = {};
  if (authUsersRes.data && authUsersRes.data.users) {
    authUsersRes.data.users.forEach(function(u) {
      emailMap[u.id] = u.email || "";
    });
  }

  // Attach email to each profile
  var profiles = (profilesRes.data || []).map(function(p) {
    return Object.assign({}, p, { email: emailMap[p.id] || "" });
  });

  return NextResponse.json({
    profiles: profiles,
    tenants: tenantsRes.data || [],
    analyses: analysesRes.data || [],
  });
}
