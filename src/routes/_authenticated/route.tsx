import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
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

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
  pendingComponent: AuthLoading,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate({ to: "/auth", search: { redirect: redirectTo }, replace: true });
    }
  }, [loading, navigate, user]);

  if (loading || !user) {
    return <AuthLoading />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
