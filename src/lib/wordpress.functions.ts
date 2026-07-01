import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const importWordpressInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { basicAuthHeader, fetchJson, extractFromHtml, sha256 } = await import(
      "@/lib/wordpress.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readSiteSecret } = await import("@/lib/site-secrets.server");

    const { data: site, error } = await supabase
      .from("sites")
      .select("id, org_id, base_url, wp_username")
      .eq("id", data.site_id)
      .single();
    if (error || !site) throw new Error(error?.message ?? "Site not found");
    const pw = await readSiteSecret(supabaseAdmin, site.id, "wp_app_password");
    if (!pw) throw new Error("Missing WordPress credentials.");
    const auth = basicAuthHeader(site.wp_username ?? "", pw);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const postType of ["posts", "pages"] as const) {
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const url =
          `${site.base_url}/wp-json/wp/v2/${postType}` +
          `?per_page=100&page=${page}&context=edit&status=publish,draft,private,future`;
        const res = await fetchJson<unknown[]>(url, {
          headers: { Authorization: auth },
          timeoutMs: 30000,
        });
        if (!res.ok) {
          errors.push(`${postType} page ${page}: HTTP ${res.status}`);
          break;
        }
        totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1") || 1;
        const items = (res.data ?? []) as Array<Record<string, any>>;
        for (const item of items) {
          try {
            const renderedHtml: string = item?.content?.rendered ?? "";
            const rawHtml: string = item?.content?.raw ?? "";
            const link: string = item?.link ?? "";
            if (!link) {
              skipped++;
              continue;
            }
            const extracted = extractFromHtml(renderedHtml, site.base_url);
            const hash = sha256((rawHtml || renderedHtml) + "::" + (item?.modified_gmt ?? ""));
            const metaDesc =
              item?.yoast_head_json?.description ??
              item?.rank_math_description ??
              item?.meta?.description ??
              null;
            const metaTitle = item?.yoast_head_json?.title ?? item?.title?.rendered ?? null;

            const { data: pageRow, error: upErr } = await supabaseAdmin
              .from("pages")
              .upsert(
                {
                  site_id: site.id,
                  url: link,
                  wp_post_id: item?.id ?? null,
                  post_type: item?.type ?? postType,
                  status: item?.status ?? null,
                  slug: item?.slug ?? null,
                  title: item?.title?.rendered ?? null,
                  meta_title: metaTitle,
                  excerpt: stripTags(item?.excerpt?.rendered ?? ""),
                  meta_description: metaDesc,
                  word_count: extracted.word_count,
                  modified_at: item?.modified_gmt ? new Date(item.modified_gmt).toISOString() : null,
                  raw_content_html: rawHtml || null,
                  rendered_content_html: renderedHtml || null,
                  content_hash: hash,
                  extracted: extracted as never,
                  last_imported_at: new Date().toISOString(),
                  indexability_status:
                    item?.status === "publish" ? "indexable" : "non-indexable",
                },
                { onConflict: "site_id,url" },
              )
              .select("id")
              .single();
            if (upErr) {
              errors.push(`upsert ${link}: ${upErr.message}`);
              continue;
            }

            const { data: latestSnapshot } = await supabaseAdmin
              .from("page_snapshots")
              .select("hash")
              .eq("page_id", pageRow!.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestSnapshot?.hash !== hash) {
              await supabaseAdmin.from("page_snapshots").insert({
                site_id: site.id,
                page_id: pageRow!.id,
                raw_html: rawHtml || null,
                rendered_html: renderedHtml || null,
                headings: extracted.headings as never,
                schema_jsonld: extracted.schema_jsonld as never,
                internal_link_count: extracted.internal_links.length,
                outbound_link_count: extracted.outbound_links.length,
                affiliate_link_count: extracted.affiliate_links.length,
                image_count: extracted.images.length,
                hash,
              });
            }
            imported++;
          } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
          }
        }
        page++;
      }
    }

    await supabase.from("audit_logs").insert({
      org_id: site.org_id,
      site_id: site.id,
      user_id: userId,
      action: "wp.import_inventory",
      entity_type: "site",
      entity_id: site.id,
      after: { imported, skipped, errors: errors.slice(0, 10) },
    });

    return { imported, skipped, errors: errors.slice(0, 20) };
  });

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
