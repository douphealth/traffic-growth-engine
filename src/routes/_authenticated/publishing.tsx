import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PipelineActions, PipelineCommandCenter } from "@/components/ops-workspace";
import { useSiteScope } from "@/hooks/use-site-scope";

export const Route = createFileRoute("/_authenticated/publishing")({
  component: PublishingQueue,
});

const statusTone: Record<string, "outline" | "default" | "secondary"> = {
  queued: "outline",
  running: "default",
  succeeded: "secondary",
  failed: "outline",
  rolled_back: "outline",
};

function PublishingQueue() {
  const { siteId } = useSiteScope();
  const q = useQuery({
    queryKey: ["publish-jobs", siteId ?? "all"],
    queryFn: async () => {
      let req = supabase
        .from("publish_jobs")
        .select("id, mode, status, requested_by, created_at, pages(url)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (siteId) req = req.eq("site_id", siteId);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Publishing Queue"
        description="Publish jobs only appear after validated, approved diffs. No silent live WordPress writes."
        actions={<Button asChild><Link to="/validation">Open validation</Link></Button>}
      />
      <PageBody>
        <PipelineCommandCenter focus="Publishing is intentionally gated: evidence → diff → validation → approval → rollback snapshot → write." />
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 ? (
          <EmptyState
            title="No publish jobs yet"
            description="Approve a validated diff to queue a publish job. Every live update stores a rollback snapshot before writing."
            action={<PipelineActions scope="compact" />}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Page</th>
                    <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data?.map((j: any) => (
                    <tr key={j.id} className="border-t border-border">
                      <td className="px-4 py-3 truncate max-w-[320px]">{j.pages?.url ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">{String(j.mode).replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusTone[j.status] ?? "outline"} className="capitalize">{String(j.status).replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(j.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Indexing note: AutoTraffic AI uses IndexNow where supported, plus Search Console sitemap freshness and internal linking for Google. It does not call the Google Indexing API for blog posts and does not promise instant indexing.
        </p>
      </PageBody>
    </>
  );
}
