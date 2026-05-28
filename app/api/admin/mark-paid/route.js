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

export async function POST(request) {
  try {
    var cookieStore = cookies();
    var supabaseAuth = createServerClient(
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

    var authResult = await supabaseAuth.auth.getUser();
    var caller = authResult.data && authResult.data.user;
    if (!caller) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    var supabase = createAdminClient();

    var callerProfile = await supabase.from("profiles").select("role").eq("id", caller.id).single();
    if (!callerProfile.data || callerProfile.data.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    var body = await request.json();
    var userId = body.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
    }

    // Get user email from auth
    var authUserRes = await supabase.auth.admin.getUserById(userId);
    var userEmail = authUserRes.data && authUserRes.data.user ? authUserRes.data.user.email : null;

    // Fetch profile
    var profileRes = await supabase
      .from("profiles")
      .select("full_name, company_name, whatsapp")
      .eq("id", userId)
      .single();
    var prof = profileRes.data || {};

    // Update profile to paid
    await supabase
      .from("profiles")
      .update({ plan: "paid", analyses_used: 0 })
      .eq("id", userId);

    // Check if tenant already exists for this user
    var tenantCheck = await supabase
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    var tenantId = tenantCheck.data ? tenantCheck.data.id : null;

    if (!tenantId) {
      var baseSlug = (prof.company_name || "my-business")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      var suffix = Math.random().toString(36).slice(2, 6);
      var slug = (baseSlug || "business") + "-" + suffix;

      var tenantInsert = await supabase
        .from("tenants")
        .insert({
          name: prof.company_name || "My Business",
          slug: slug,
          owner_id: userId,
          owner_email: userEmail,
          ceo_name: prof.full_name || null,
          owner_whatsapp: prof.whatsapp || null,
          plan: "pro",
          analysis_limit: 300,
          analyses_this_month: 0,
          is_active: true,
        })
        .select()
        .single();

      if (tenantInsert.error) {
        console.error("Tenant insert error:", tenantInsert.error);
        return NextResponse.json({ success: false, error: tenantInsert.error.message }, { status: 500 });
      }

      tenantId = tenantInsert.data.id;
    }

    // Upsert tenant_member
    await supabase
      .from("tenant_members")
      .upsert(
        { tenant_id: tenantId, user_id: userId, role: "owner" },
        { onConflict: "tenant_id,user_id", ignoreDuplicates: true }
      );

    // Set default_tenant_id on profile
    await supabase
      .from("profiles")
      .update({ default_tenant_id: tenantId })
      .eq("id", userId);

    return NextResponse.json({ success: true, tenantId: tenantId });

  } catch (err) {
    console.error("mark-paid error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
