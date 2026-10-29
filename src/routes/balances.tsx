import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import { Button } from "@/components/ui/button";
import { inr, memberName } from "@/lib/format";
import { useBalances, useGroup, useSettlements } from "@/lib/queries";
import { Money } from "@/components/Money";
import { KhataMascot } from "@/components/KhataMascot";

export const Route = createFileRoute("/balances")({
  head: () => ({
    meta: [
      { title: "Balances — Hostel Khata" },
      { name: "description", content: "See who gets money back and who owes in your flat." },
      { property: "og:title", content: "Balances — Hostel Khata" },
      { property: "og:description", content: "See who gets money back and who owes in your flat." },
    ],
  }),
  component: BalancesPage,
});

function BalancesPage() {
  const { data: group } = useGroup();
  const q = useBalances();
  const flows = useSettlements();

  return (
    <div>
      <PageTitle
        title="Dosti ka hisaab"
        subtitle="Mint gets money back. Coral owes. Dosti stays priceless."
      />
      {q.isLoading ? (
        <ListSkeleton rows={5} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.some((b) => Math.abs(b.net) >= 0.01) ? (
        <EmptyState
          emoji="🎉"
          title="Sab barabar!"
          body="Nobody owes anything right now."
          celebrate
        />
      ) : (
        (() => {
          const max = Math.max(...q.data.map((b) => Math.abs(b.net)), 1);
          return (
            <div className="space-y-5">
              {max >= 1000 && (
                <div className="flex items-center gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4">
                  <KhataMascot worried small />
                  <p className="text-sm text-muted-foreground">
                    Khata ko thodi tension hai. Ek payment, aur dosti sorted.
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {[...q.data]
                  .sort((a, b) => b.net - a.net)
                  .map((b) => {
                    const name = memberName(group?.members, b.memberId);
                    const pos = b.net >= 0;
                    return (
                      <div
                        key={b.memberId}
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={name} />
                          <div className="flex-1">
                            <p className="font-semibold">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.abs(b.net) < 0.01 ? "Settled" : pos ? "gets back" : "owes"}
                            </p>
                          </div>
                          <p
                            className={`font-display text-xl font-bold ${pos ? "text-positive" : "text-negative"}`}
                          >
                            {pos ? "+" : "−"}
                            <Money amount={b.net} />
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-1">
                          <div className="flex justify-end">
                            {!pos && (
                              <div
                                className="h-2 rounded-l-full bg-negative"
                                style={{ width: `${(Math.abs(b.net) / max) * 100}%` }}
                              />
                            )}
                          </div>
                          <div>
                            {pos && (
                              <div
                                className="h-2 rounded-r-full bg-positive"
                                style={{ width: `${(b.net / max) * 100}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <section className="rounded-3xl border border-border bg-card p-5">
                <h2 className="font-display text-xl font-bold">Who owes whom</h2>
                <p className="mb-5 mt-1 text-xs text-muted-foreground">
                  Simplified payments · thicker arrow, bigger amount
                </p>
                {flows.isLoading ? (
                  <ListSkeleton rows={2} />
                ) : flows.isError ? (
                  <ErrorState error={flows.error} onRetry={() => flows.refetch()} />
                ) : !flows.data?.length ? (
                  <p className="text-sm text-muted-foreground">No payments needed.</p>
                ) : (
                  <ul className="space-y-5">
                    {flows.data.map((flow, i) => {
                      const from = memberName(group?.members, flow.fromId),
                        to = memberName(group?.members, flow.toId);
                      const largest = Math.max(...flows.data.map((item) => item.amount), 1);
                      return (
                        <li key={`${flow.fromId}-${flow.toId}`} className="flex items-center gap-3">
                          <div className="w-16 shrink-0 text-center">
                            <div className="flex justify-center">
                              <Avatar name={from} />
                            </div>
                            <p className="mt-1 truncate text-xs">{from}</p>
                          </div>
                          <div className="min-w-0 flex-1 text-center">
                            <p className="mb-1 text-sm font-bold text-primary">
                              <Money amount={flow.amount} />
                            </p>
                            <svg
                              aria-hidden="true"
                              className="h-7 w-full text-primary"
                              viewBox="0 0 200 28"
                              preserveAspectRatio="none"
                            >
                              <path
                                d="M2 14H184m-8-7 12 7-12 7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1 + (flow.amount / largest) * 5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="sr-only">
                              {from} pays {to} {inr(flow.amount)}
                            </span>
                          </div>
                          <div className="w-16 shrink-0 text-center">
                            <div className="flex justify-center">
                              <Avatar name={to} />
                            </div>
                            <p className="mt-1 truncate text-xs">{to}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <Button asChild className="h-14 w-full rounded-2xl text-base">
                <Link to="/settle">Settle up</Link>
              </Button>
            </div>
          );
        })()
      )}
    </div>
  );
}
