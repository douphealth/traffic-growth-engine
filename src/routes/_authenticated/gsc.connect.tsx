import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Link2, RefreshCw, LogOut, ShieldCheck, ExternalLink } from "lucide-react";
import {
  startGscOAuth,
  listGscProperties,
  connectGscPropertyToSite,
  disconnectGoogle,
  getGoogleConnection,
  autoLinkGscProperties,
} from "@/lib/gsc-oauth.functions";
import {
  importAllConnectedGscProperties,
  getGscDiagnostics,
} from "@/lib/gsc-pages.functions";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/gsc/connect")({
  component: GscConnectPage,
});

function GscConnectPage() {
  const qc = useQueryClient();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const justConnected = params.get("gsc") === "connected";
  const errParam = params.get("gsc_error");

  useEffect(() => {
    if (justConnected) {
      const properties = params.get("properties");
      const created = params.get("created");
      const linked = params.get("linked");
      toast.success(
        properties
          ? `Google connected — synced ${properties} propert${properties === "1" ? "y" : "ies"}, created ${created ?? "0"} site${created === "1" ? "" : "s"}, linked ${linked ?? "0"}.`
          : "Google Search Console connected — syncing properties now.",
      );
    }
    if (errParam) toast.error(`Google OAuth failed: ${errParam}`);
  }, [justConnected, errParam]);

  const connQ = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => getGoogleConnection(),
  });

  const propsQ = useQuery({
    queryKey: ["gsc-properties"],
    queryFn: () => listGscProperties({ data: { refresh: false } }),
    enabled: !!connQ.data,
  });

  const sitesQ = useQuery({
    queryKey: ["sites-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, base_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mappingsQ = useQuery({
    queryKey: ["site-gsc-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_gsc_connections")
        .select("site_id, gsc_property_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const start = useMutation({
    mutationFn: () => startGscOAuth({ data: { redirect_after: "/gsc/connect" } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.reason);
        return;
      }
      if (r.mode === "connector") {
        toast.success(
          r.created + r.linked === 0
            ? `Synced ${r.properties} Search Console propert${r.properties === 1 ? "y" : "ies"}.`
            : `Auto-linked ${r.linked} propert${r.linked === 1 ? "y" : "ies"}` +
                (r.created > 0 ? ` · created ${r.created} site${r.created === 1 ? "" : "s"}` : ""),
        );
        qc.invalidateQueries({ queryKey: ["google-connection"] });
        qc.invalidateQueries({ queryKey: ["gsc-properties"] });
        qc.invalidateQueries({ queryKey: ["sites-min"] });
        qc.invalidateQueries({ queryKey: ["sites"] });
        return;
      }
      if (r.mode === "oauth") window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = useMutation({
    mutationFn: () => listGscProperties({ data: { refresh: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gsc-properties"] });
      toast.success("Property list refreshed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disc = useMutation({
    mutationFn: () => disconnectGoogle(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      qc.invalidateQueries({ queryKey: ["gsc-properties"] });
      toast.success("Disconnected");
    },
  });

  const autoLink = useMutation({
    mutationFn: () => autoLinkGscProperties(),
    onSuccess: (r) => {
      if (r.ok && (r.created > 0 || r.linked > 0)) {
        toast.success(
          `Auto-linked ${r.linked} propert${r.linked === 1 ? "y" : "ies"}` +
            (r.created > 0 ? ` · created ${r.created} site${r.created === 1 ? "" : "s"}` : ""),
        );
      }
      qc.invalidateQueries({ queryKey: ["site-gsc-mappings"] });
      qc.invalidateQueries({ queryKey: ["sites-min"] });
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conn = connQ.data;
  const propsRes = propsQ.data;
  const properties = propsRes && propsRes.ok ? propsRes.properties : [];

  const diagQ = useQuery({
    queryKey: ["gsc-diagnostics"],
    queryFn: () => getGscDiagnostics(),
    refetchOnWindowFocus: false,
  });

  const importAll = useMutation({
    mutationFn: () => importAllConnectedGscProperties(),
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.totals.rows} rows · ${r.totals.urls} URLs · ${r.totals.pages} pages · ${r.totals.opportunities} opportunities across ${r.processed} site${r.processed === 1 ? "" : "s"}.`,
      );
      const failures = r.results.filter((x) => !x.ok);
      if (failures.length) {
        toast.error(`${failures.length} site${failures.length === 1 ? "" : "s"} failed — see diagnostics.`);
      }
      qc.invalidateQueries({ queryKey: ["gsc-diagnostics"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // Auto-link once properties are loaded and we have at least one unlinked property.
  useEffect(() => {
    if (!propsRes || !propsRes.ok) return;
    if (!mappingsQ.data) return;
    const linkedIds = new Set((mappingsQ.data ?? []).map((m) => m.gsc_property_id));
    const hasUnlinked = (propsRes.properties ?? []).some(
      (p: { id: string }) => !linkedIds.has(p.id),
    );
    if (hasUnlinked && !autoLink.isPending && !autoLink.isSuccess) {
      autoLink.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsRes, mappingsQ.data]);

  return (
    <>
      <PageHeader
        title="Google Search Console"
        description="Connect Search Console once; AutoTraffic automatically discovers every property in that Google account, creates the sites, and links them for imports."
      />
      <PageBody>
        {!conn && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect Google Search Console</CardTitle>
              <CardDescription>
                We&apos;ll request read-only Search Console access, then automatically create and
                link every website/property available in that Google account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Read-only access</AlertTitle>
                <AlertDescription>
                  This connector is separate from app login. Tokens are encrypted server-side and
                  only used to list properties and import Search Console metrics.
                </AlertDescription>
              </Alert>
              <div className="mt-4">
                <Button onClick={() => start.mutate()} disabled={start.isPending}>
                  {start.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Connect Google
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {conn && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Connected Google account</CardTitle>
                    <CardDescription>
                      {conn.google_email ?? "Google Search Console connector"} ·{" "}
                      <Badge variant="secondary" className="capitalize">
                        {conn.status}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refresh.mutate()}
                      disabled={refresh.isPending}
                    >
                      <RefreshCw className={`mr-1 h-3 w-3 ${refresh.isPending ? "animate-spin" : ""}`} />
                      Refresh properties
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disc.mutate()}
                      disabled={disc.isPending}
                    >
                      <LogOut className="mr-1 h-3 w-3" /> Disconnect
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Import data for all Search Console properties</CardTitle>
                    <CardDescription>
                      One click runs the full pipeline for every linked property: import GSC rows → discover pages from URLs → score opportunities.
                    </CardDescription>
                  </div>
                  <Button onClick={() => importAll.mutate()} disabled={importAll.isPending}>
                    {importAll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                    Import all properties
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {diagQ.data && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
                    <DiagRow label="OAuth configured" value={diagQ.data.oauthConfigured ? "yes" : "no"} ok={diagQ.data.oauthConfigured} />
                    <DiagRow label="Google connected" value={diagQ.data.connection ? "yes" : "no"} ok={!!diagQ.data.connection} />
                    <DiagRow label="Account" value={diagQ.data.connection?.email ?? "—"} />
                    <DiagRow label="Refresh token stored" value={diagQ.data.refreshTokenStored ? "yes" : "no"} ok={diagQ.data.refreshTokenStored} />
                    <DiagRow label="GSC properties" value={String(diagQ.data.propertyCount)} />
                    <DiagRow label="Linked to sites" value={String(diagQ.data.linkedSiteCount)} />
                    <DiagRow label="GSC rows imported" value={String(diagQ.data.gscRows)} />
                    <DiagRow label="URLs discovered" value={String(diagQ.data.gscUrls)} />
                    <DiagRow label="Pages from GSC" value={String(diagQ.data.pagesFromGsc)} />
                    <DiagRow label="Opportunities" value={String(diagQ.data.opportunities)} />
                    <DiagRow label="Last import" value={diagQ.data.lastImport ? new Date(diagQ.data.lastImport).toLocaleString() : "never"} />
                    <DiagRow label="Gateway fallback" value={diagQ.data.gatewayConfigured ? "available" : "off"} />
                  </div>
                )}
              </CardContent>
            </Card>



            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Search Console properties</CardTitle>
                <CardDescription>
                  These are auto-linked to site records. Manual linking below is only a repair tool
                  if you intentionally want to override a mapping.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {propsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {propsRes && !propsRes.ok && (
                  <p className="text-sm text-destructive">{propsRes.reason}</p>
                )}
                {propsRes && propsRes.ok && properties.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No properties returned yet. Click &quot;Refresh properties&quot; to sync from Google.
                  </p>
                )}
                {properties.length > 0 && (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {properties.map((p: any) => (
                      <PropertyRow
                        key={p.id}
                        prop={p}
                        sites={sitesQ.data ?? []}
                        mappings={mappingsQ.data ?? []}
                        onConnected={() => {
                          qc.invalidateQueries({ queryKey: ["site-gsc-mappings"] });
                          qc.invalidateQueries({ queryKey: ["sites"] });
                          qc.invalidateQueries({ queryKey: ["gsc-properties"] });
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}

function PropertyRow({
  prop,
  sites,
  mappings,
  onConnected,
}: {
  prop: { id: string; site_url: string; permission_level: string | null };
  sites: { id: string; name: string; base_url: string }[];
  mappings: { site_id: string; gsc_property_id: string }[];
  onConnected: () => void;
}) {
  const linkedSiteId = mappings.find((m) => m.gsc_property_id === prop.id)?.site_id;
  const [selected, setSelected] = useState<string>(linkedSiteId ?? "");

  const link = useMutation({
    mutationFn: () =>
      connectGscPropertyToSite({ data: { site_id: selected, gsc_property_id: prop.id } }),
    onSuccess: () => {
      toast.success("Property linked");
      onConnected();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium truncate">
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate">{prop.site_url}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {prop.permission_level ?? "—"}
          {linkedSiteId && (
            <>
              {" · "}
              <span className="text-success">linked</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-8 w-[220px]">
            <SelectValue placeholder="Choose a WordPress site" />
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!selected || link.isPending}
          onClick={() => link.mutate()}
        >
          {link.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Link2 className="mr-1 h-3 w-3" />}
          Link
        </Button>
      </div>
    </div>
  );
}
