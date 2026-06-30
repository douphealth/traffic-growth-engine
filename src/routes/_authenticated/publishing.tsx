import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockPublishJobs } from "@/lib/mock-data";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/publishing")({
  component: PublishingQueue,
});

const statusTone = {
  queued: "outline",
  running: "default",
  succeeded: "secondary",
  failed: "outline",
  rolled_back: "outline",
} as const;

function PublishingQueue() {
  return (
    <>
      <PageHeader
        title="Publishing Queue"
        description="Drafts publish freely. Live updates require validated diffs, an approver, and a stored rollback snapshot. Every job is auditable."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Page</th>
                  <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Requested by</th>
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockPublishJobs.map((j) => (
                  <tr key={j.id} className="border-t border-border">
                    <td className="px-4 py-3 truncate max-w-[260px]">{j.page_url}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">{j.mode.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusTone[j.status]} className="capitalize">{j.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{j.requested_by}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(j.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {j.status === "succeeded" && j.mode === "live_update" && (
                        <Button variant="outline" size="sm">
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Rollback
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Indexing note: AutoTraffic AI uses IndexNow where supported and Search Console sitemap
          freshness + internal linking for Google. It does not call the Google Indexing API for blog
          posts and does not promise instant indexing.
        </p>
      </PageBody>
    </>
  );
}
