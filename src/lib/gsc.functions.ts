import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type ValidGscRow = {
  date: string;
  url: string;
  query: string;
  country: string | null;
  device: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const GSC_GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_search_console";

function hasGscGatewayConnection(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_SEARCH_CONSOLE_API_KEY);
}

async function callGscGateway(path: string, init?: RequestInit): Promise<Response> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
  if (!lovableKey || !connectionKey) throw new Error("Google Search Console connector is not linked.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connectionKey);
  const res = await fetch(`${GSC_GATEWAY_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GSC connector ${res.status}: ${t.slice(0, 200)}`);
  }
  return res;
}

// Legacy service-account JWT path (kept as fallback)
async function getServiceAccountToken(): Promise<string | null> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as { client_email: string; private_key: string };
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64(header)}.${b64(claim)}`;
    const { createSign } = await import("crypto");
    const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
    const assertion = `${unsigned}.${sig}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()));
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateGscRow(row: GscRow): { ok: true; row: ValidGscRow } | { ok: false; reason: string } {
  const [date, url, query, country, device] = row.keys ?? [];
  if (!isIsoDate(date)) return { ok: false, reason: "invalid_date" };
  if (!isHttpUrl(url)) return { ok: false, reason: "invalid_url" };
  if (typeof query !== "string") return { ok: false, reason: "invalid_query" };

  const clicks = Math.round(Number(row.clicks));
  const impressions = Math.round(Number(row.impressions));
  const ctr = Number(row.ctr);
  const position = Number(row.position);

  if (!Number.isFinite(clicks) || clicks < 0) return { ok: false, reason: "invalid_clicks" };
  if (!Number.isFinite(impressions) || impressions < 0) return { ok: false, reason: "invalid_impressions" };
  if (clicks > impressions && impressions > 0) return { ok: false, reason: "clicks_gt_impressions" };
  if (!Number.isFinite(ctr) || ctr < 0 || ctr > 1) return { ok: false, reason: "invalid_ctr" };
  if (!Number.isFinite(position) || position <= 0 || position > 1000) return { ok: false, reason: "invalid_position" };

  return {
    ok: true,
    row: {
      date,
      url,
      query,
      country: country || null,
      device: device || null,
      clicks,
      impressions,
      ctr: Number(ctr.toFixed(4)),
      position: Number(position.toFixed(2)),
    },
  };
}

const WINDOWS: { label: string; offsetEnd: number; days: number }[] = [
  // Import non-overlapping 90-day evidence windows. The UI and scoring can derive
  // 28-day slices from this data without hammering GSC with duplicate requests.
  { label: "last_90", offsetEnd: 3, days: 90 },
  { label: "prev_90", offsetEnd: 93, days: 90 },
];

type ImportTarget = {
  property: string;
  gsc_property_id: string | null;
  connection_id: string | null;
  source: "oauth" | "service_account" | "connector";
  accessToken: string | null;
};

export const importGscData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: site } = await supabase
      .from("sites")
      .select("id, org_id, base_url, gsc_property")
      .eq("id", data.site_id)
      .single();
    if (!site) throw new Error("Site not found");

    // Prefer all OAuth/Gateway properties mapped to this site. A canonical site can
    // legitimately have both sc-domain: and URL-prefix properties; importing only
    // the "primary" variant makes the app look vague and incomplete.
    const { data: mappings } = await supabase
      .from("site_gsc_connections")
      .select("gsc_property_id, is_primary, gsc_properties:gsc_property_id (site_url, connection_id)")
      .eq("site_id", site.id)
      .order("is_primary", { ascending: false })
      .limit(25);

    const mappedRows = ((mappings ?? []) as Array<{
      gsc_property_id: string;
      is_primary?: boolean | null;
      gsc_properties: { site_url: string; connection_id: string } | { site_url: string; connection_id: string }[] | null;
    }>).flatMap((m) => {
      const prop = Array.isArray(m.gsc_properties) ? m.gsc_properties[0] : m.gsc_properties;
      return prop?.site_url && prop.connection_id
        ? [{ gsc_property_id: m.gsc_property_id, site_url: prop.site_url, connection_id: prop.connection_id }]
        : [];
    });

    const targets: ImportTarget[] = [];
    const propertyErrors: string[] = [];

    if (mappedRows.length) {
      const tokenCache = new Map<string, string>();
      const { getFreshAccessToken } = await import("@/lib/google-tokens.server");
      const seen = new Set<string>();
      for (const m of mappedRows) {
        if (seen.has(m.site_url)) continue;
        seen.add(m.site_url);
        const { data: connection } = await supabase
          .from("google_connections")
          .select("status")
          .eq("id", m.connection_id)
          .maybeSingle();

        if (connection?.status === "connector" && hasGscGatewayConnection()) {
          targets.push({ property: m.site_url, gsc_property_id: m.gsc_property_id, connection_id: m.connection_id, source: "connector", accessToken: null });
          continue;
        }

        try {
          const cached = tokenCache.get(m.connection_id);
          const token = cached ?? await getFreshAccessToken(supabaseAdmin, m.connection_id);
          tokenCache.set(m.connection_id, token);
          targets.push({ property: m.site_url, gsc_property_id: m.gsc_property_id, connection_id: m.connection_id, source: "oauth", accessToken: token });
        } catch (e) {
          propertyErrors.push(`${m.site_url}: ${e instanceof Error ? e.message : "unknown token error"}`);
        }
      }

      if (!targets.length) {
        return {
          status: "not_connected" as const,
          reason: `Google connection failed. ${propertyErrors.join("; ") || "Reconnect at /gsc/connect."}`,
        };
      }
    } else if (site.gsc_property) {
      // Fallback: service account + manual property
      const sa = await getServiceAccountToken();
      if (!sa) {
        return {
          status: "not_connected" as const,
          reason:
            "No Google Search Console connection. Connect via /gsc/connect and link this site to a property.",
        };
      }
      targets.push({ property: site.gsc_property, gsc_property_id: null, connection_id: null, source: "service_account", accessToken: sa });
    } else {
      return {
        status: "not_connected" as const,
        reason:
          "This site has no Search Console property. Connect Google at /gsc/connect and select a property.",
      };
    }

    let totalRows = 0;
    let skippedRows = 0;
    const skippedByReason: Record<string, number> = {};

    for (const target of targets) {
      const encoded = encodeURIComponent(target.property);
      const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
      for (const win of WINDOWS) {
        const end = new Date(Date.now() - win.offsetEnd * 86400000);
        const start = new Date(end.getTime() - (win.days - 1) * 86400000);
        let startRow = 0;
        const rowLimit = 25000;
        while (true) {
          const body = {
            startDate: fmt(start),
            endDate: fmt(end),
            dimensions: ["date", "page", "query", "country", "device"],
            rowLimit,
            startRow,
          };
          const res = target.source === "connector"
            ? await callGscGateway(`/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              })
            : await fetch(endpoint, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${target.accessToken}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify(body),
              });
          if (!res.ok) {
            const t = await res.text();
            propertyErrors.push(`${target.property}: GSC API ${res.status}: ${t.slice(0, 200)}`);
            break;
          }
          const j = (await res.json()) as { rows?: GscRow[] };
          const rows = j.rows ?? [];
          if (!rows.length) break;
          const upserts = rows.flatMap((r) => {
            const valid = validateGscRow(r);
            if (!valid.ok) {
              skippedRows += 1;
              skippedByReason[valid.reason] = (skippedByReason[valid.reason] ?? 0) + 1;
              return [];
            }
            return [{
              site_id: site.id,
              gsc_property_id: target.gsc_property_id,
              import_source: target.source,
              imported_at: new Date().toISOString(),
              date: valid.row.date,
              url: valid.row.url,
              query: valid.row.query,
              country: valid.row.country,
              device: valid.row.device,
              clicks: valid.row.clicks,
              impressions: valid.row.impressions,
              ctr: valid.row.ctr,
              position: valid.row.position,
            }];
          });
          if (!upserts.length) {
            if (rows.length < rowLimit) break;
            startRow += rowLimit;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("gsc_page_query_daily")
            .upsert(upserts as never, {
              onConflict: "site_id,date,url,query,country,device",
            });
          if (error) throw new Error(error.message);
          totalRows += upserts.length;
          if (rows.length < rowLimit) break;
          startRow += rowLimit;
        }
      }
    }

    // Chain: discover pages from GSC URLs, then score opportunities.
    let pagesResult = { discovered: 0, inserted: 0, updated: 0 };
    let oppsResult = { inserted: 0, by_type: {} as Record<string, number> };
    try {
      const { syncPagesFromGsc } = await import("@/lib/gsc-pages.functions");
      pagesResult = await syncPagesFromGsc({ data: { site_id: site.id } });
    } catch (e) {
      console.error("syncPagesFromGsc failed", e);
    }
    try {
      const { scoreOpportunities } = await import("@/lib/opportunities.functions");
      oppsResult = await scoreOpportunities({ data: { site_id: site.id } });
    } catch (e) {
      console.error("scoreOpportunities failed", e);
    }

    await supabase.from("audit_logs").insert({
      org_id: site.org_id,
      site_id: site.id,
      user_id: userId,
      action: "gsc.import",
      entity_type: "site",
      entity_id: site.id,
      after: {
        rows: totalRows,
        skipped_rows: skippedRows,
        skipped_by_reason: skippedByReason,
        source: targets.length === 1 ? targets[0]?.source : "multiple",
        properties: targets.map((t) => t.property),
        property_errors: propertyErrors,
        pages: pagesResult,
        opportunities: oppsResult.inserted,
      },
    });

    await supabaseAdmin
      .from("sites")
      .update({
        last_pipeline_run_at: new Date().toISOString(),
        data_quality_status: totalRows > 0 ? "gsc_imported" : "gsc_connected_no_rows",
      } as never)
      .eq("id", site.id);

    return {
      status: "ok" as const,
      rows: totalRows,
      skipped_rows: skippedRows,
      skipped_by_reason: skippedByReason,
      source: targets.length === 1 ? targets[0]?.source : "multiple",
      property: targets[0]?.property ?? null,
      properties: targets.map((t) => t.property),
      property_errors: propertyErrors,
      pages: pagesResult,
      opportunities: oppsResult.inserted,
      opportunities_by_type: oppsResult.by_type,
    };
  });

