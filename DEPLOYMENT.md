# CreditScore Pro — Deployment Guide

## STEP 1: Set Up Supabase Database

1. Go to your Supabase project: https://icqwoxqjgtuzuwjyrqhs.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy-paste the entire contents of `supabase-schema.sql` and click **Run**
5. You should see "Success. No rows returned" — that means the tables are created

### Get your keys:
- Go to **Settings → API**
- Copy `anon` `public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` `secret` key → this is your `SUPABASE_SERVICE_ROLE_KEY`

### Enable Google Auth (optional):
- Go to **Authentication → Providers → Google**
- Enable it and add your Google OAuth credentials
- If you skip this, email/password login still works

### Set Site URL:
- Go to **Authentication → URL Configuration**
- Set Site URL to: `https://your-app.vercel.app` (update after deploying)
- Add to Redirect URLs: `https://your-app.vercel.app/api/auth/callback`


## STEP 2: Push Code to GitHub

```bash
# Navigate to the project
cd creditscore-pro

# Initialize git
git init
git add .
git commit -m "CreditScore Pro v1.0"

# Create a GitHub repo (go to github.com → New repository → "creditscore-pro")
git remote add origin https://github.com/YOUR_USERNAME/creditscore-pro.git
git branch -M main
git push -u origin main
```


## STEP 3: Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository** → select `creditscore-pro`
3. Framework: **Next.js** (auto-detected)
4. Add **Environment Variables**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://icqwoxqjgtuzuwjyrqhs.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (your anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (your service role key) |
| `OPENAI_API_KEY` | (your sk-proj-... key) |
| `NEXT_PUBLIC_APP_URL` | (your Vercel URL, update after first deploy) |

5. Click **Deploy**
6. After deploy, copy the URL (e.g. `https://creditscore-pro.vercel.app`)
7. Go back to Supabase → Authentication → URL Configuration
8. Update Site URL to your Vercel URL
9. Add `https://your-url.vercel.app/api/auth/callback` to Redirect URLs


## STEP 4: Test It

1. Visit your deployed URL
2. Click "Analyze my credit free"
3. Sign up with email
4. Fill out the 4-step form with test data:
   - Name: Test User, email: test@test.com
   - Scores: TU 720, EX 715, EQ 710
   - Utilization: 25%, Primary accounts: 5, Credit age: 3, Highest limit: 15000, Inquiries: 2
   - Personal info: Yes, Errors: 0, Late payments: 0, Negative items: 0
5. Click "Run AI analysis"
6. You should see the results page with a 10/10 score
7. Test PDF download


## STEP 5: Set Up for a Client (GHL Integration)

When a client buys CreditScore Pro, they need:

1. **Create a tenant** — insert into `tenants` table:
```sql
INSERT INTO tenants (name, slug, owner_id, ghl_api_key, ghl_location_id, ghl_enabled, plan)
VALUES ('Client Business Name', 'client-slug', 'user-uuid-here', 'their-ghl-api-key', 'their-location-id', true, 'pro');
```

2. **GHL Custom Fields** — Client creates these 10 custom fields in their GHL sub-account:
   - credit_score_tu (Text)
   - credit_score_ex (Text)
   - credit_score_eq (Text)
   - credit_score_avg (Text)
   - funding_readiness_score (Text)
   - funding_readiness_pct (Text)
   - estimated_funding (Text)
   - analysis_date (Text)
   - criteria_passed (Text)
   - criteria_failed (Text)

3. **GHL Workflow** — Client creates a workflow triggered by tag `analysis_complete` to:
   - Send automated email with results
   - Add to pipeline
   - Trigger follow-up sequence

4. **GHL Tags** that auto-apply:
   - `analysis_complete` — after every analysis
   - `funding_ready` — score 8+/10
   - `needs_improvement` — score 5-7/10
   - `significant_work_needed` — score below 5/10


## File Structure

```
creditscore-pro/
├── app/
│   ├── page.js              ← Landing page
│   ├── layout.js             ← Root layout
│   ├── globals.css            ← Styles + Karvonix theme
│   ├── login/page.js          ← Login (email + Google)
│   ├── signup/page.js         ← Registration
│   ├── dashboard/page.js      ← Admin dashboard
│   ├── analysis/
│   │   ├── new/page.js        ← Multi-step form + PDF upload
│   │   └── [id]/page.js       ← Results detail page
│   └── api/
│       ├── analyze/route.js   ← Analysis engine + AI + GHL sync
│       ├── upload/route.js    ← PDF/image upload + AI parsing
│       └── auth/callback/route.js ← Supabase auth callback
├── lib/
│   ├── analysis.js            ← 10-criteria rule engine
│   ├── ghl.js                 ← GHL API v2 integration
│   ├── pdf-report.js          ← PDF report generation
│   ├── supabase-browser.js    ← Supabase client (browser)
│   └── supabase-server.js     ← Supabase client (server)
├── middleware.js               ← Auth protection
├── supabase-schema.sql         ← Database schema
├── .env.local.example          ← Environment variables template
├── package.json
├── tailwind.config.js
├── next.config.js
└── jsconfig.json
```


## Cost Summary

| Service | Cost |
|---------|------|
| Supabase | Free tier (50K rows, 500MB) |
| OpenAI API | ~$0.001/analysis (form), ~$0.006 (PDF) |
| Vercel | Free tier (100GB bandwidth) |
| **Total per analysis** | **~$0.001 - $0.006** |
| **100 analyses/month** | **~$0.10 - $0.60** |
