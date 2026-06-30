import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") {
      return { user: null };
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
  pendingComponent: AuthLoading,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      throw redirect({ to: "/auth", search: { redirect: window.location.href } });
    }
  }, [loading, user]);

  if (loading || !user) {
    return <AuthLoading />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
