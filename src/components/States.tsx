import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { memberIdentity } from "@/lib/member-identity";
import { KhataMascot } from "@/components/KhataMascot";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
  celebrate = false,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: ReactNode;
  celebrate?: boolean;
}) {
  return (
    <div className="relative isolate flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      {celebrate ? (
        <>
          <KhataMascot />
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${i * 4.3}%`,
                  animationDelay: `${(i % 6) * 0.1}s`,
                  background: `var(--chart-${(i % 5) + 1})`,
                  transform: `rotate(${i * 37}deg)`,
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mb-3 text-5xl">{emoji}</div>
      )}
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-destructive/30 bg-card px-6 py-10 text-center">
      <AlertTriangle className="mb-2 h-8 w-8 text-destructive" />
      <p className="font-semibold">Couldn't load this</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Something went wrong."}
      </p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function ListSkeleton({ rows = 4, h = "h-16" }: { rows?: number; h?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`${h} w-full rounded-2xl`} />
      ))}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const identity = memberIdentity(name);
  return (
    <span
      aria-label={name}
      style={{ backgroundColor: identity.color, color: "oklch(.2 .02 60)" }}
      className="member-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ring-2 ring-background"
    >
      {identity.initials}
    </span>
  );
}
