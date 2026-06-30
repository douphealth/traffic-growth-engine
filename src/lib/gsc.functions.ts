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

async function getServiceAccountToken(): Promise<string | null> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as { client_email: string; private_key: string };
    // Build JWT (RS256) for OAuth assertion
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64(header)}.${b64(claim)}`;
    const { createSign } = await import("crypto");
    const sig = createSign("RSA-SHA256")
      .update(unsigned)
      .sign(sa.private_key)
      .toString("base64url");
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
    if (!site.gsc_property) {
      return { status: "not_connected" as const, reason: "No GSC property set on this site." };
    }
    const token = await getServiceAccountToken();
    if (!token) {
      return {
        status: "not_connected" as const,
        reason:
          "Google Search Console service account is not configured. Add a GSC_SERVICE_ACCOUNT_JSON secret and share the property with the service account email.",
      };
    }

    const property = encodeURIComponent(site.gsc_property);
    const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${property}/searchAnalytics/query`;
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
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
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
        if (startRow > 250000) break; // safety
      }
    }

    await supabase.from("audit_logs").insert({
      org_id: site.org_id,
      site_id: site.id,
      user_id: userId,
      action: "gsc.import",
      entity_type: "site",
      entity_id: site.id,
      after: { rows: totalRows },
    });

    return { status: "ok" as const, rows: totalRows };
  });
