
# Phase 2A + 2B — Real data engine

Turn the mock dashboard into a real data-driven engine. No AI writing, no Stripe, no SERP, no AI visibility polling yet.

## 1. Database migration (one migration)

Schema fixes only — no data writes.

- **`pages`** — add `meta_title`, `raw_content_html`, `rendered_content_html`, `content_hash`, `indexability_status`, `noindex bool`, `canonical_mismatch bool`, `in_sitemap bool default false`, `last_imported_at timestamptz`. Add `unique (site_id, url)` if not present.
- **Unique constraints**:
  - `gsc_page_query_daily (site_id, date, url, query, country, device)`
  - `ga4_landing_daily (site_id, date, landing_path)`
  - `sitemap_urls (site_id, url)`
- **Roles**: add `app_role` enum (`owner`, `admin`, `editor`, `viewer`) + `user_roles (user_id, org_id, role)` table with `has_role(uid, org, role)` security-definer fn. Backfill existing `organization_members.role`.
- **RLS rewrite** for `sites`, `pages`, `page_snapshots`, `sitemap_urls`, `gsc_page_query_daily`, `ga4_landing_daily`, `opportunities`, `content_briefs`, `content_diffs`, `publish_jobs`, `encrypted_site_secrets`, `audit_logs`:
  - viewer: SELECT only
  - editor: + INSERT/UPDATE on `content_briefs`, `content_diffs`
  - admin/owner: full incl. site connect, secrets, publish approval, deletes
  - service_role: full (for background imports)
- GRANTs on every public table.

## 2. Server functions (TanStack `createServerFn`, all under `src/lib/*.functions.ts` + `*.server.ts` helpers)

All authenticated with `requireSupabaseAuth`. Helpers that touch secrets / admin client live in `.server.ts`.

### A. `connect-wordpress-site` (`src/lib/sites.functions.ts`)
- Input (Zod): name, base_url, wp_username, wp_app_password, sitemap_url?, gsc_property?, ga4_property?
- Validate URL, normalize (strip trailing slash).
- `GET {base_url}/wp-json/` → confirm WP REST online.
- `GET {base_url}/wp-json/wp/v2/users/me` with Basic auth (user + app password) → confirm credentials.
- Admin-only role check.
- Insert into `sites`, insert app password into `encrypted_site_secrets` (pgcrypto `pgp_sym_encrypt` with `ENCRYPTION_KEY` secret).
- Audit log entry.
- Return `{ site_id, wp_version, wp_user, status }`. Never return the password.

### B. `import-wordpress-inventory` (`src/lib/wordpress.functions.ts` + `wordpress.server.ts`)
- Decrypt creds server-side.
- Paginate `/wp-json/wp/v2/posts` and `/wp-json/wp/v2/pages` with `per_page=100&context=edit` until `X-WP-TotalPages` exhausted.
- For each item: extract title, slug, status, modified, excerpt, Yoast/RankMath meta (`yoast_head_json.description` if present), raw + rendered HTML, word count, sha256 content hash.
- Parse HTML (lightweight regex / `linkedom` if available — prefer `node-html-parser`) for headings (h1-h3), internal vs external links, affiliate links (matching `affiliate_links.url_pattern`), images, JSON-LD blocks.
- Upsert into `pages` on `(site_id, url)`. Snapshot raw payload into `page_snapshots`.
- Audit log; return counts.

### C. `crawl-sitemap` (`src/lib/sitemap.functions.ts`)
- Fetch sitemap_url; if `<sitemapindex>` recurse children.
- Insert/upsert URLs into `sitemap_urls`.
- Update `pages.in_sitemap = true` where matched.
- Return `{ sitemap_count, matched, wp_missing_from_sitemap, sitemap_missing_from_wp }`.

### D. `import-gsc-data` (`src/lib/gsc.functions.ts`)
- Placeholder OAuth: read `GSC_SERVICE_ACCOUNT_JSON` secret if present; otherwise return `{ status: 'not_connected' }`.
- Loop windows: last 28d, prev 28d, last 90d, prev 90d.
- Call `searchanalytics/query` with dimensions `[page, query, country, device]`, `rowLimit=25000`, paginate via `startRow`.
- Upsert into `gsc_page_query_daily`.
- Audit log.

### E. `score-opportunities` (`src/lib/opportunities.functions.ts`)
- Pull pages + GSC aggregates + GA4 + affiliate_links + internal_links + schema_items for the site.
- Per-page derived metrics (last-28 vs prev-28):
  - **CTR leak**: position ≤10 and CTR < expected curve by >30%.
  - **Striking distance**: avg position 8–20 with impressions > threshold.
  - **Decay**: clicks down >30% vs prior window.
  - **Cannibalization**: ≥2 URLs ranking for same query top-20.
  - **Indexation risk**: noindex / canonical_mismatch / not in sitemap on high-traffic page.
  - **Internal link gap**: page has 0 inbound internal links.
  - **Schema gap**: no JSON-LD on commercially relevant page.
  - **AI answer gap**: long-form page lacking concise summary/FAQ.
  - **Monetization leak**: high-traffic page with no affiliate link.
- Score each 0–100 on impact, confidence, effort, risk, reversibility.
- `priority` per the weighted formula in the request.
- Wipe prior `status='open'` rows for site/type and reinsert; preserve dismissed.
- Return counts.

### F. Helper queries (`src/lib/dashboard.functions.ts`)
- `getSites` (with KPIs joined), `getSitePages(site_id)`, `getOpportunities(filters)`.

## 3. Frontend changes

Wire TanStack Query + `useServerFn`. Add empty states everywhere.

- **`sites.connect.tsx`**: real submit → `connect-wordpress-site`. Show test result (WP version, user). On success navigate to site detail.
- **`sites.index.tsx`**: real list via `getSites`. Card actions: "Import WP Inventory", "Crawl Sitemap", "Import GSC Data" (disabled if not connected), "Re-test connection".
- New **`sites.$siteId.tsx`**: real pages table — URL, post type, status, word count, modified, indexability, in_sitemap, clicks/impr/CTR/position from GSC (28d).
- **`opportunities.tsx`**: real list, "Run scoring" button (calls `score-opportunities`), filters (type, status, risk, confidence, site), sort by priority.
- **`dashboard.tsx`**: real KPIs (sites, pages, open opportunities, top 10 by priority). Empty state when zero data.
- **Demo mode**: add toggle in Settings + `localStorage` flag + global top banner "Demo mode — showing sample data". When ON, components fall back to `mock-data.ts`. When OFF (default), only real Supabase.
- Remove mock imports from dashboard, sites.index, opportunities (unless behind demo toggle).
- `content.tsx`, `validation.tsx`, `publishing.tsx`: out of scope this phase — leave intact but add a "Mock — pending Phase 2C" badge banner. (They are not in the success criteria.)

## 4. Secrets to add

- `ENCRYPTION_KEY` (generated, 64 chars) — for `pgp_sym_encrypt` of WP app passwords.
- `GSC_SERVICE_ACCOUNT_JSON` — requested from user only when they're ready to wire GSC; until then the import returns "not_connected".

## 5. Out of scope (explicit)

- AI writing / Lovable AI calls
- SERP tracking, AI visibility polling
- Real publishing/rollback execution (UI stays mocked with banner)
- Stripe

## Technical notes

- WordPress fetch uses native `fetch` (Workers-safe). No `sharp`, no `puppeteer`.
- HTML parsing via `node-html-parser` (Workers-safe). Will `bun add` if missing.
- Sitemap XML parsed via `fast-xml-parser` (Workers-safe).
- All server fns return plain DTOs; `supabaseAdmin` loaded inside handlers via dynamic import.
- One migration up front; then implement server fns; then UI swaps; verify end-to-end with a live WP site if the user provides one, otherwise verify build + empty states render.

Ready to execute on approval.
