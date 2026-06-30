import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockSchemaItems } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/schema")({
  component: SchemaPage,
});

function SchemaPage() {
  return (
    <>
      <PageHeader
        title="Schema"
        description="Schema is only recommended when supported by visible content. Fake ratings, unsupported reviews, and schema/content mismatch are blocked at validation."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Page</th>
                  <th className="px-4 py-2.5 text-left font-medium">Current</th>
                  <th className="px-4 py-2.5 text-left font-medium">Recommended</th>
                  <th className="px-4 py-2.5 text-left font-medium">Visible evidence</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {mockSchemaItems.map((s) => (
                  <tr key={s.page_url} className="border-t border-border">
                    <td className="px-4 py-3 truncate max-w-[260px]">{s.page_url}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{s.current}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="secondary">{s.recommended}</Badge></td>
                    <td className="px-4 py-3">
                      {s.evidence_ok ? (
                        <span className="text-xs text-success">✓ supported by visible content</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">— add visible FAQs first</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" disabled={!s.evidence_ok}>
                        Generate JSON-LD
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
