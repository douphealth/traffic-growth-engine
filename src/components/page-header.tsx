import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  badge = null,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-background/50 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {badge && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-3xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-6 space-y-6", className)}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-xs text-muted-foreground max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
