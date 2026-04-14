# Supabase backend setup (BioSample Tracker)

This guide matches the SQL in `supabase/migrations/` and your current React data model (`mockData.js` / `DataContext`). The app still runs on **mocks** until you wire `AuthContext` and `DataContext` to `src/lib/supabaseClient.js`.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Choose a strong database password and region close to your users.
3. When the project is ready, open **Settings → API** and copy:
   - **Project URL**
   - **anon public** key (safe for the browser with RLS enabled)

Do **not** put the **service_role** key in Vite or Netlify “public” env vars used by the client.

---

## 2. Run the database migrations

### Option A — Supabase Dashboard (simplest)

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste and run the full contents of  
   `supabase/migrations/20250415120000_initial_schema.sql`
3. Then paste and run  
   `supabase/migrations/20250415120001_rls_policies.sql`

If anything errors, read the message (often enum already exists, or trigger name conflict). Fix and re-run only the failed parts.

### Option B — Supabase CLI

```bash
npm i -g supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

---

## 3. Configure Authentication

1. **Authentication → Providers → Email**: enable Email (password). Turn off “Confirm email” for class demos if you want instant login (less secure).
2. **Authentication → URL configuration**:
   - **Site URL**: your Netlify production URL (e.g. `https://your-app.netlify.app`).
   - **Redirect URLs**: add `http://localhost:5173/**` (Vite default) and your Netlify URL.

---

## 4. Bootstrap your first Admin user

New signups get a `profiles` row with role **Student** and status **Pending** (see trigger in the first migration).

To get an **Admin** who can use the app with current RLS (`is_active_user()` requires **Active**):

1. **Authentication → Users → Add user**  
   Create the user with email + password.
2. **Table Editor → `profiles`**  
   Find the row for that user’s `id` (same as `auth.users.id`). Set:
   - `role` = `Admin`
   - `status` = `Active`
   - `full_name` as you like

Alternatively run in SQL Editor (replace the UUID with the user’s id from `auth.users`):

```sql
update public.profiles
set role = 'Admin', status = 'Active', full_name = 'Dr. Maria Santos'
where id = '00000000-0000-0000-0000-000000000000';
```

---

## 5. Seed mock data (import from this repo)

The file **`supabase/seed/seed_mock_data.sql`** mirrors **`src/data/mockData.js`**: organisms, projects, samples, activity log, pending requests, and co-researcher invites.

1. Open **SQL Editor** in Supabase.
2. Paste the **entire** contents of `supabase/seed/seed_mock_data.sql` and run it.
3. Confirm in **Table Editor** that rows appear in `organisms`, `projects`, `samples`, etc.

**Notes:**

- Most inserts use **`ON CONFLICT DO NOTHING`** so you can re-run safely for those tables.
- **`activity_log`** inserts **append** each time (no conflict key). If you re-run the script and get duplicates, truncate first: `truncate public.activity_log;` (dev only).
- **`profiles`** are **not** inserted here: each row must match **`auth.users`**. Create users under **Authentication → Users** (use the same emails as `MOCK_USERS` in `mockData.js` if you want parity). The signup trigger creates a `profiles` row; then **uncomment and run** the `UPDATE public.profiles ...` block at the bottom of the seed file (remove the `/*` and `*/`) to align roles, `legacy_id`, and names with the mock.

Until you seed (and wire the app to Supabase), the hosted DB can look empty while the UI still uses mocks locally.

---

## 6. Netlify environment variables

In Netlify: **Site configuration → Environment variables**

| Key | Value |
|-----|--------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |

Redeploy the site after saving. Vite inlines `VITE_*` at **build** time, so a new deploy is required when these change.

---

## 7. Local development

1. Copy `.env.example` to `.env` in the project root.
2. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install deps (includes `@supabase/supabase-js`):

   ```bash
   npm install
   ```

4. `npm run dev` — `import.meta.env.VITE_*` is loaded from `.env`.

`.env` should stay gitignored (already typical in `.gitignore`).

---

## 8. Wire the React app (your next coding tasks)

The repo includes **`src/lib/supabaseClient.js`**, which exports `supabase` (or `null` if env is missing).

Recommended order:

1. **Login / session**  
   - Replace mock login in `AuthContext` with `supabase.auth.signInWithPassword`.  
   - On success, load `profiles` for `auth.user.id` and map to your existing `user` object shape (`fullName`, `role`, `status`, …).  
   - `supabase.auth.onAuthStateChange` to sync logout/tab refresh.  
   - Remove storing passwords in `authStore` for real users; Supabase Auth owns credentials.

2. **Reads**  
   - Replace `useState(MOCK_*)` initial loads with `supabase.from('samples').select(...)` etc.  
   - Map DB column names (`snake_case`) to the camelCase fields the UI expects (e.g. `lead_researcher` → `leadResearcher`, `co_researchers` → `coResearchers`).

3. **Writes**  
   - Point `addSample`, `updateProject`, `approvePendingRequest`, etc. at `insert` / `update` / `delete` calls.

4. **Feature flag (optional)**  
   - e.g. `VITE_USE_SUPABASE=true` — when false, keep current mocks for demos.

---

## 9. Row Level Security (important)

`20250415120001_rls_policies.sql` uses a **development-friendly** rule: any **Active** user can read/write all domain tables. That matches a small team prototype but is **not** production-safe.

Next iteration: express `getVisibleSamples` / `getVisibleProjects` logic as SQL policies (e.g. students only `publication_status = 'Published'`, researchers only their projects, etc.).

---

## 10. Column ↔ app field cheat sheet

| Table (DB) | Notes |
|-------------|--------|
| `profiles` | `full_name`, `role`, `status`, `legacy_id` optional for old display ids |
| `organisms` | `scientific_name`, `common_name`, `taxonomy_id`, `kingdom` |
| `projects` | `co_researchers`, `approved_exporters` are `text[]` |
| `samples` | `sample_id`, `organism_id`, `project_id`, `collection_date`, … |
| `activity_log` | use `created_at`; compute “time ago” in the UI |
| `pending_requests` | `changes`, `proposed_updates`, `proposed_sample` as `jsonb` |
| `co_researcher_invites` | `invited_by`, `invited_to`, `status` |

---

## 11. Checklist before you call it “done”

- [ ] Migrations applied without errors  
- [ ] At least one **Active** **Admin** exists in `profiles`  
- [ ] Netlify env vars set and site redeployed  
- [ ] Login works from production URL  
- [ ] RLS tested as Student / Researcher / Admin  
- [ ] No `service_role` key in frontend or public env  

When you want help implementing `AuthContext` / `DataContext` against these tables, say which screen you want first (e.g. login only, then samples list).
