import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Globe } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "autotraffic.site_scope.v1";

export type SiteOption = { id: string; name: string; canonical_host: string | null };

type SiteScopeValue = {
  siteId: string | null;
  setSiteId: (id: string | null) => void;
  sites: SiteOption[];
  currentSite: SiteOption | null;
  loading: boolean;
  /** Apply `.eq('site_id', siteId)` when scoped; pass-through otherwise. */
  scopeFilter: <T extends { eq: (col: string, v: string) => T }>(qb: T, column?: string) => T;
  /** Include the scope in query keys. */
  scopedKey: (base: readonly unknown[]) => readonly unknown[];
};

const SiteScopeContext = createContext<SiteScopeValue | null>(null);

export function SiteScopeProvider({ children }: { children: ReactNode }) {
  const sitesQ = useQuery({
    queryKey: ["site-scope-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, canonical_host")
        .order("name");
      if (error) throw error;
      return (data ?? []) as SiteOption[];
    },
  });

  const [siteId, setSiteIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Auto-select the only site if just one exists and none stored.
  useEffect(() => {
    if (!sitesQ.data || siteId) return;
    if (sitesQ.data.length === 1) setSiteIdState(sitesQ.data[0].id);
  }, [sitesQ.data, siteId]);

  // Drop stale selection if the site disappeared.
  useEffect(() => {
    if (!sitesQ.data || !siteId) return;
    if (!sitesQ.data.some((s) => s.id === siteId)) setSiteIdState(null);
  }, [sitesQ.data, siteId]);

  const setSiteId = (id: string | null) => {
    setSiteIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const value = useMemo<SiteScopeValue>(() => {
    const currentSite = sitesQ.data?.find((s) => s.id === siteId) ?? null;
    return {
      siteId,
      setSiteId,
      sites: sitesQ.data ?? [],
      currentSite,
      loading: sitesQ.isLoading,
      scopeFilter: (qb, column = "site_id") => (siteId ? qb.eq(column, siteId) : qb),
      scopedKey: (base) => [...base, siteId ?? "all"],
    };
  }, [siteId, sitesQ.data, sitesQ.isLoading]);

  return <SiteScopeContext.Provider value={value}>{children}</SiteScopeContext.Provider>;
}

export function useSiteScope(): SiteScopeValue {
  const ctx = useContext(SiteScopeContext);
  if (!ctx) throw new Error("useSiteScope must be used within SiteScopeProvider");
  return ctx;
}

export function SiteScopeSelector({ className }: { className?: string }) {
  const { sites, siteId, setSiteId, currentSite, loading } = useSiteScope();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 min-w-[220px] justify-between gap-2", className)}
          disabled={loading}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-left">
              {currentSite ? currentSite.name : "All sites"}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            {!siteId && sites.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{sites.length}</Badge>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Filter sites…" />
          <CommandList>
            <CommandEmpty>No sites yet. Connect Search Console first.</CommandEmpty>
            <CommandGroup heading="Scope">
              <CommandItem
                value="__all__"
                onSelect={() => {
                  setSiteId(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-3.5 w-3.5", !siteId ? "opacity-100" : "opacity-0")} />
                All sites
                <Badge variant="outline" className="ml-auto text-[10px]">{sites.length}</Badge>
              </CommandItem>
            </CommandGroup>
            {sites.length > 0 && (
              <CommandGroup heading="Sites">
                {sites.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`${s.name} ${s.canonical_host ?? ""}`}
                    onSelect={() => {
                      setSiteId(s.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5", siteId === s.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{s.name}</div>
                      {s.canonical_host && (
                        <div className="truncate text-[10px] text-muted-foreground">{s.canonical_host}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
