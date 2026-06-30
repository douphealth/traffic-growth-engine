import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { connectWordpressSite } from "@/lib/sites.functions";

export const Route = createFileRoute("/_authenticated/sites/connect")({
  component: ConnectSitePage,
});

function ConnectSitePage() {
  const navigate = useNavigate();
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
      navigate({ to: "/sites" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Connect a WordPress site"
        description="WordPress credentials are validated live, stored server-side, encrypted at rest, and never exposed to the browser."
      />
      <PageBody>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Real connection — credentials encrypted</AlertTitle>
          <AlertDescription>
            We test <code>/wp-json/</code> and authenticate against <code>/wp/v2/users/me</code> before saving.
            The Application Password is stored using pgcrypto and only readable by the service role.
          </AlertDescription>
        </Alert>

        <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WordPress REST API</CardTitle>
              <CardDescription>Create a dedicated Application Password — never an admin password.</CardDescription>
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
              <CardDescription>
                Google Search Console is now connected via OAuth — go to <span className="font-medium">GSC Connector</span> after saving to pick a property. The field below is only used for the legacy service-account fallback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field id="gsc_property" label="Google Search Console property (advanced / manual)" placeholder="sc-domain:example.com" value={form.gsc_property} onChange={(v) => set("gsc_property", v)} />
              <Field id="ga4_property_id" label="GA4 property ID" placeholder="properties/123456789" value={form.ga4_property_id} onChange={(v) => set("ga4_property_id", v)} />
              <Field id="sitemap_url" label="Sitemap URL" placeholder="https://example.com/sitemap_index.xml" value={form.sitemap_url} onChange={(v) => set("sitemap_url", v)} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-primary/30 bg-primary/5">
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

          <div className="lg:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/sites" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {submitting ? "Validating & saving…" : "Test & connect"}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
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
