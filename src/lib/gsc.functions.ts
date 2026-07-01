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

const WINDOWS: { label: string; offsetEnd: number; days: number }[] = [
  { label: "last_28", offsetEnd: 3, days: 28 },
  { label: "prev_28", offsetEnd: 31, days: 28 },
  { label: "last_90", offsetEnd: 3, days: 90 },
  { label: "prev_90", offsetEnd: 93, days: 90 },
];

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

    // Prefer OAuth connection mapped to this site
    let property: string | null = null;
    let accessToken: string | null = null;
    let source: "oauth" | "service_account" | "connector" = "service_account";

    const { data: mapping } = await supabase
      .from("site_gsc_connections")
      .select("gsc_property_id, is_primary, gsc_properties:gsc_property_id (site_url, connection_id)")
      .eq("site_id", site.id)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    const mapped = mapping as
      | { gsc_property_id: string; is_primary?: boolean | null; gsc_properties: { site_url: string; connection_id: string } | null }
      | null;

    if (mapped?.gsc_properties) {
      property = mapped.gsc_properties.site_url;

      const { data: connection } = await supabase
        .from("google_connections")
        .select("status")
        .eq("id", mapped.gsc_properties.connection_id)
        .maybeSingle();

      if (connection?.status === "connector" && hasGscGatewayConnection()) {
        source = "connector";
      } else {
        const { getFreshAccessToken } = await import("@/lib/google-tokens.server");
        try {
          accessToken = await getFreshAccessToken(supabaseAdmin, mapped.gsc_properties.connection_id);
          source = "oauth";
        } catch (e) {
          return {
            status: "not_connected" as const,
            reason: `Google connection failed: ${e instanceof Error ? e.message : "unknown"}. Reconnect at /gsc/connect.`,
          };
        }
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
      accessToken = sa;
      property = site.gsc_property;
    } else {
      return {
        status: "not_connected" as const,
        reason:
          "This site has no Search Console property. Connect Google at /gsc/connect and select a property.",
      };
    }

    const encoded = encodeURIComponent(property!);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
    let totalRows = 0;

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
        const res = source === "connector"
          ? await callGscGateway(`/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "content-type": "application/json",
              },
              body: JSON.stringify(body),
            });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`GSC API ${res.status}: ${t.slice(0, 200)}`);
        }
        const j = (await res.json()) as { rows?: GscRow[] };
        const rows = j.rows ?? [];
        if (!rows.length) break;
        const upserts = rows.map((r) => ({
          site_id: site.id,
          gsc_property_id: mapped?.gsc_property_id ?? null,
          import_source: source,
          imported_at: new Date().toISOString(),
          date: r.keys[0],
          url: r.keys[1],
          query: r.keys[2],
          country: r.keys[3],
          device: r.keys[4],
          clicks: Math.round(r.clicks),
          impressions: Math.round(r.impressions),
          ctr: Number(r.ctr.toFixed(4)),
          position: Number(r.position.toFixed(2)),
        }));
        const { error } = await supabaseAdmin
          .from("gsc_page_query_daily")
          .upsert(upserts as never, {
            onConflict: "site_id,date,url,query,country,device",
          });
        if (error) throw new Error(error.message);
        totalRows += rows.length;
        if (rows.length < rowLimit) break;
        startRow += rowLimit;
        if (startRow > 250000) break;
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
        source,
        property,
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
      source,
      property,
      pages: pagesResult,
      opportunities: oppsResult.inserted,
      opportunities_by_type: oppsResult.by_type,
    };
  });

