import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  Lock,
  Loader2,
  Search,
  Sparkles,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { connectWordpressSite } from "@/lib/sites.functions";
import {
  startGscOAuth,
  getGoogleConnection,
  listGscProperties,
  autoLinkGscProperties,
} from "@/lib/gsc-oauth.functions";

export const Route = createFileRoute("/_authenticated/sites/connect")({
  component: ConnectSitePage,
});

function ConnectSitePage() {
  const navigate = useNavigate();
  const [showWp, setShowWp] = useState(false);
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const justConnected = params.get("gsc") === "connected";

  const connQ = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => getGoogleConnection(),
  });

  const start = useMutation({
    mutationFn: () =>
      startGscOAuth({ data: { redirect_after: "/sites/connect?gsc=connected" } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.reason);
        return;
      }
      if (r.mode === "connector") {
        toast.success(
          r.created + r.linked === 0
            ? `Synced ${r.properties} Search Console propert${r.properties === 1 ? "y" : "ies"}.`
            : `Linked ${r.linked} propert${r.linked === 1 ? "y" : "ies"}` +
                (r.created > 0 ? ` · created ${r.created} site${r.created === 1 ? "" : "s"}` : ""),
        );
        navigate({ to: "/sites" });
        return;
      }
      if (r.mode === "oauth") window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoLink = useMutation({
    mutationFn: async () => {
      // Make sure GSC properties are freshly synced from Google before linking.
      await listGscProperties({ data: { refresh: true } });
      return autoLinkGscProperties();
    },
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.reason);
        return;
      }
      toast.success(
        r.created + r.linked === 0
          ? "All Search Console properties are already linked."
          : `Linked ${r.linked} propert${r.linked === 1 ? "y" : "ies"}` +
              (r.created > 0
                ? ` · created ${r.created} site${r.created === 1 ? "" : "s"}`
                : ""),
      );
      navigate({ to: "/sites" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isConnected = !!connQ.data;

  useEffect(() => {
    if (!justConnected) return;
    const properties = params.get("properties");
    const created = params.get("created");
    const linked = params.get("linked");
    toast.success(
      properties
        ? `Google connected — synced ${properties} propert${properties === "1" ? "y" : "ies"}, created ${created ?? "0"} site${created === "1" ? "" : "s"}, linked ${linked ?? "0"}.`
        : "Google connected — your Search Console properties are syncing now.",
    );
    navigate({ to: "/sites" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected]);

  return (
    <>
      <PageHeader
        title="Connect your sites"
        description="The fastest path: connect Google Search Console and we'll auto-create one site per GSC property — no WordPress credentials required to get started."
      />
      <PageBody>
        {/* PRIMARY — Google Search Console */}
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/15 p-2 text-primary">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Connect Google Search Console
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> Recommended
                    </span>
                  </CardTitle>
                  <CardDescription>
                    One click. We sign in with Google (read-only{" "}
                    <code>webmasters.readonly</code>), then automatically create a site for
                    every property in your account and link them.
                  </CardDescription>
                </div>
              </div>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-xs text-success shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Google connected
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <Bullet>Reads property list + page/query metrics</Bullet>
              <Bullet>No write access, ever</Bullet>
              <Bullet>Tokens encrypted server-side (pgcrypto)</Bullet>
              <Bullet>Disconnect any time from GSC Connector</Bullet>
            </ul>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!isConnected ? (
                <Button
                  size="lg"
                  onClick={() => start.mutate()}
                  disabled={start.isPending}
                >
                  {start.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Connect Google & auto-create sites
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => autoLink.mutate()}
                    disabled={autoLink.isPending}
                  >
                    {autoLink.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Auto-create sites from my GSC properties
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/gsc/connect">Manage properties</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Safety defaults */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Safety defaults</CardTitle>
            </div>
            <CardDescription>You can change these per-site in Settings later.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Bullet>Live WordPress updates require explicit approval per change.</Bullet>
            <Bullet>Every update saves a full rollback snapshot before writing.</Bullet>
            <Bullet>Validation blocks broken links, lost images, and schema without evidence.</Bullet>
            <Bullet>AI content is never mass-published. Drafts only until you approve.</Bullet>
          </CardContent>
        </Card>

        {/* SECONDARY — WordPress (advanced, optional) */}
        <div>
          <button
            type="button"
            onClick={() => setShowWp((s) => !s)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showWp ? "" : "-rotate-90"}`}
            />
            Advanced: also connect WordPress credentials for a specific site (optional — only
            needed to publish or import full content)
          </button>

          {showWp && (
            <div className="mt-3">
              <WordpressForm onDone={() => navigate({ to: "/sites" })} />
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}

function WordpressForm({ onDone }: { onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    base_url: "",
    wp_username: "",
    wp_app_password: "",
    sitemap_url: "",
    gsc_property: "",
    ga4_property_id: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await connectWordpressSite({ data: form });
      if (!res.ok) {
        toast.error(res.message ?? "Connection failed");
        return;
      }
      toast.success(`Connected as ${res.wp_user}. Ready to import inventory.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <Alert className="lg:col-span-2">
        <Lock className="h-4 w-4" />
        <AlertTitle>Credentials encrypted server-side</AlertTitle>
        <AlertDescription>
          We test <code>/wp-json/</code> and authenticate against{" "}
          <code>/wp/v2/users/me</code> before saving. The Application Password is stored using
          pgcrypto and only readable by the service role.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WordPress REST API</CardTitle>
          <CardDescription>
            Create a dedicated Application Password — never an admin password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field id="name" label="Site name" value={form.name} onChange={(v) => set("name", v)} required />
          <Field id="base_url" label="Site URL" placeholder="https://example.com" type="url" value={form.base_url} onChange={(v) => set("base_url", v)} required />
          <Field id="wp_username" label="WordPress username" value={form.wp_username} onChange={(v) => set("wp_username", v)} required />
          <Field id="wp_app_password" label="Application Password" type="password" value={form.wp_app_password} onChange={(v) => set("wp_app_password", v)} required helper="Stored encrypted server-side. Never sent to the browser after save." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analytics & SEO sources</CardTitle>
          <CardDescription>Optional manual overrides.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field id="gsc_property" label="GSC property (manual override)" placeholder="sc-domain:example.com" value={form.gsc_property} onChange={(v) => set("gsc_property", v)} />
          <Field id="ga4_property_id" label="GA4 property ID" placeholder="properties/123456789" value={form.ga4_property_id} onChange={(v) => set("ga4_property_id", v)} />
          <Field id="sitemap_url" label="Sitemap URL" placeholder="https://example.com/sitemap_index.xml" value={form.sitemap_url} onChange={(v) => set("sitemap_url", v)} />
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {submitting ? "Validating & saving…" : "Test & connect WordPress"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  helper,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
