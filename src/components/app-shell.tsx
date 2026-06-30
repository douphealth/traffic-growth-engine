import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Globe,
  Target,
  FileEdit,
  Search,
  Sparkles,
  Network,
  Coins,
  FlaskConical,
  Settings,
  LogOut,
  Activity,
  ShieldCheck,
  Send,
  Code2,
  TrendingUp,
  Search as SearchIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { toast } from "sonner";
import type { ReactNode } from "react";

const primary = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Site Inventory", to: "/sites", icon: Globe },
  { title: "Opportunities", to: "/opportunities", icon: Target },
  { title: "Content Pipeline", to: "/content", icon: FileEdit },
  { title: "Keyword Strategy", to: "/keywords", icon: Search },
  { title: "AI Visibility", to: "/ai-visibility", icon: Sparkles },
  { title: "Internal Links", to: "/internal-links", icon: Network },
  { title: "Monetization", to: "/monetization", icon: Coins },
  { title: "Experiments", to: "/experiments", icon: FlaskConical },
] as const;

const secondary = [
  { title: "GSC Connector", to: "/gsc/connect", icon: SearchIcon },
  { title: "Validation", to: "/validation", icon: ShieldCheck },
  { title: "Publishing Queue", to: "/publishing", icon: Send },
  { title: "Schema", to: "/schema", icon: Code2 },
  { title: "Revenue", to: "/revenue", icon: TrendingUp },
  { title: "Settings", to: "/settings", icon: Settings },
] as const;

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 outline-none">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">AutoTraffic AI</span>
              <span className="text-[10px] text-muted-foreground">Growth OS</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Growth OS</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.title}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Operations</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {secondary.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.title}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && (
          <Badge variant="outline" className="w-full justify-center text-[10px] font-normal text-muted-foreground">
            v0.1 · single-tenant dev
          </Badge>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [demo] = useDemoMode();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          {demo && (
            <div className="border-b border-warning/40 bg-warning/10 px-4 py-1.5 text-center text-[11px] font-medium text-warning">
              Demo mode is ON — screens that lack real data show mock fixtures. Toggle off in Settings.
            </div>
          )}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="hidden sm:block text-sm text-muted-foreground">
                <span className="text-foreground font-medium">AutoTraffic AI</span>
                <span className="mx-2">·</span>
                <span>Growth OS</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
