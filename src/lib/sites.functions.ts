import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ConnectInput = z.object({
  name: z.string().min(1).max(120),
  base_url: z.string().url(),
  wp_username: z.string().min(1).max(120),
  wp_app_password: z.string().min(8).max(200),
  sitemap_url: z.string().url().optional().or(z.literal("")),
  gsc_property: z.string().max(200).optional().or(z.literal("")),
  ga4_property_id: z.string().max(200).optional().or(z.literal("")),
});

export const connectWordpressSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConnectInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { normalizeBaseUrl, basicAuthHeader, fetchJson } = await import("@/lib/wordpress.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { storeSiteSecret } = await import("@/lib/site-secrets.server");

    const baseUrl = normalizeBaseUrl(data.base_url);

    // Find user's org (use first org they're admin of)
    const { data: orgs, error: orgErr } = await supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", userId);
    if (orgErr) throw new Error(orgErr.message);
    const adminOrg = orgs?.find((o) => o.role === "owner" || o.role === "admin");
    if (!adminOrg) throw new Error("You must be an org admin or owner to connect sites.");

    // Test WP REST root
    const root = await fetchJson<{ name?: string; description?: string }>(
      `${baseUrl}/wp-json/`,
      { timeoutMs: 12000 },
    );
    if (!root.ok) {
      return {
        ok: false as const,
        stage: "wp_rest_root" as const,
        message: `WordPress REST not reachable (HTTP ${root.status}). Confirm /wp-json/ is enabled.`,
      };
    }

    // Test authenticated /users/me
    const me = await fetchJson<{ id?: number; name?: string; slug?: string }>(
      `${baseUrl}/wp-json/wp/v2/users/me?context=edit`,
      {
        timeoutMs: 12000,
        headers: { Authorization: basicAuthHeader(data.wp_username, data.wp_app_password) },
      },
    );
    if (!me.ok || !me.data?.id) {
      return {
        ok: false as const,
        stage: "wp_auth" as const,
        message: `WordPress authentication failed (HTTP ${me.status}). Check username and Application Password.`,
      };
    }

    // Insert site
    const { data: siteRow, error: siteErr } = await supabase
      .from("sites")
      .insert({
        org_id: adminOrg.org_id,
        name: data.name,
        base_url: baseUrl,
        wp_username: data.wp_username,
        sitemap_url: data.sitemap_url || null,
        gsc_property: data.gsc_property || null,
        ga4_property_id: data.ga4_property_id || null,
        status: "connected",
      })
      .select("id, org_id")
      .single();
    if (siteErr || !siteRow) throw new Error(siteErr?.message ?? "Failed to insert site");

    // Encrypt + store WP app password via admin client
    try {
      await storeSiteSecret(supabaseAdmin, siteRow.id, "wp_app_password", data.wp_app_password);
    } catch (e) {
      // Rollback site
      await supabase.from("sites").delete().eq("id", siteRow.id);
      throw new Error(
        `Could not encrypt credentials: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    await supabase.from("audit_logs").insert({
      org_id: siteRow.org_id,
      site_id: siteRow.id,
      user_id: userId,
      action: "site.connect",
      entity_type: "site",
      entity_id: siteRow.id,
      after: { base_url: baseUrl, wp_user: data.wp_username, wp_user_id: me.data.id },
    });

    return {
      ok: true as const,
      site_id: siteRow.id,
      wp_user: me.data.name ?? data.wp_username,
      wp_user_id: me.data.id,
      base_url: baseUrl,
    };
  });

export const testWordpressConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { basicAuthHeader, fetchJson } = await import("@/lib/wordpress.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readSiteSecret } = await import("@/lib/site-secrets.server");

    const { data: site } = await supabase
      .from("sites")
      .select("id, base_url, wp_username")
      .eq("id", data.site_id)
      .single();
    if (!site) throw new Error("Site not found");
    const pw = await readSiteSecret(supabaseAdmin, site.id, "wp_app_password");
    if (!pw) return { ok: false as const, message: "No stored WP app password" };
    const me = await fetchJson<{ id?: number; name?: string }>(
      `${site.base_url}/wp-json/wp/v2/users/me?context=edit`,
      {
        headers: { Authorization: basicAuthHeader(site.wp_username ?? "", pw) },
        timeoutMs: 12000,
      },
    );
    return me.ok
      ? { ok: true as const, wp_user: me.data?.name ?? site.wp_username }
      : { ok: false as const, message: `HTTP ${me.status}` };
  });
