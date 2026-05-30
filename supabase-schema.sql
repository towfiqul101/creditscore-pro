-- ═══════════════════════════════════════════════════════════════════
-- CreditScore Pro — Database Schema
-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════

-- 1. TENANTS (each credit repair business that buys your product)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#39FF14',
  brand_name TEXT DEFAULT 'CreditScore Pro',
  owner_id UUID REFERENCES auth.users(id),
  -- GHL Integration (optional)
  ghl_api_key TEXT,
  ghl_location_id TEXT,
  ghl_enabled BOOLEAN DEFAULT FALSE,
  -- Plan & billing
  plan TEXT DEFAULT 'starter', -- starter, pro, agency
  analysis_limit INT DEFAULT 50,
  analyses_this_month INT DEFAULT 0,
  billing_reset_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  is_active BOOLEAN DEFAULT TRUE
);

-- 2. TENANT MEMBERS (users who belong to a tenant)
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, admin, member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- 3. ANALYSES (every credit analysis run)
CREATE TABLE IF NOT EXISTS analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  -- Contact info
  contact_first_name TEXT,
  contact_last_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  -- Scores
  score_tu INT,
  score_ex INT,
  score_eq INT,
  score_avg INT,
  -- Funding readiness
  funding_score INT, -- 0-10
  funding_percentage INT, -- 0-100
  estimated_funding TEXT,
  -- Full results (JSON)
  results JSONB,
  summary TEXT,
  priority_actions JSONB,
  -- Input data (for re-analysis)
  input_data JSONB,
  -- Source
  source TEXT DEFAULT 'form', -- form, pdf_upload
  -- GHL sync status
  ghl_synced BOOLEAN DEFAULT FALSE,
  ghl_contact_id TEXT
);

-- 4. PROFILES (extends auth.users with app-specific data)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user', -- user, admin (admin = you, the SaaS owner)
  default_tenant_id UUID REFERENCES tenants(id)
);

-- ─── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analyses_tenant ON analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_email ON analyses(contact_email);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable insert for auth users" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tenants: members can view their tenant
CREATE POLICY "Tenant members can view tenant" ON tenants FOR SELECT USING (
  id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  OR owner_id = auth.uid()
);
CREATE POLICY "Tenant owners can update" ON tenants FOR UPDATE USING (owner_id = auth.uid());

-- Tenant members: can view members of their own tenant
CREATE POLICY "View tenant members" ON tenant_members FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
);

-- Analyses: tenant members can view analyses for their tenant
CREATE POLICY "View tenant analyses" ON analyses FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "Create analyses" ON analyses FOR INSERT WITH CHECK (true);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ──────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── PHASE 4c ADDITIONS ─────────────────────────────────────────────

-- notification_steps: per-tenant drip campaign steps (up to 3 per tenant)
CREATE TABLE IF NOT EXISTS notification_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  delay_days INT DEFAULT 0,
  delay_hours INT DEFAULT 0,
  delay_minutes INT DEFAULT 0,
  send_sms BOOLEAN DEFAULT FALSE,
  send_email BOOLEAN DEFAULT TRUE,
  email_type TEXT DEFAULT 'full_results',
  email_subject TEXT,
  email_intro TEXT,
  email_body TEXT,
  cta_enabled BOOLEAN DEFAULT FALSE,
  cta_text TEXT,
  cta_url TEXT,
  sms_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, step_order)
);

ALTER TABLE notification_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant owners can manage steps" ON notification_steps
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner'));

-- New columns on notification_queue for step-level config
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS step_id UUID REFERENCES notification_steps(id);
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS step_order INT DEFAULT 1;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS email_type TEXT DEFAULT 'full_results';
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS email_intro TEXT;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS email_body TEXT;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS cta_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS cta_text TEXT;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS cta_url TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- Next: Go to Authentication → URL Configuration in Supabase
-- Set Site URL to your Vercel URL (e.g. https://creditscore-pro.vercel.app)
-- ═══════════════════════════════════════════════════════════════════
