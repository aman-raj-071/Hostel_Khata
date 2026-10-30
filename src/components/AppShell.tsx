import { Link, useLocation } from "@tanstack/react-router";
import { BarChart3, History, Menu, Plus, Scale, Users, Wallet, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGroup } from "@/lib/queries";
import { ErrorState } from "@/components/States";
import { DraftRecovery } from "@/components/DraftRecovery";
import { GroupTools } from "@/components/GroupTools";

const TABS = [
  { to: "/", label: "Add", icon: Plus },
  { to: "/balances", label: "Balances", icon: Scale },
  { to: "/settle", label: "Settle", icon: Wallet },
  { to: "/history", label: "History", icon: History },
  { to: "/report", label: "Report", icon: BarChart3 },
  { to: "/wrapped", label: "Wrapped", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const groupQuery = useGroup();
  const group = groupQuery.data;
  const { pathname } = useLocation();
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      setLight(localStorage.getItem("khata-theme") === "light");
    } catch {
      /* Storage may be blocked. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
    document.documentElement.classList.toggle("dark", !light);
  }, [light]);
  return (
    <div className="app-frame mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            ₹
          </span>
          <div className="leading-tight">
            <p className="font-display text-base font-bold">Hostel Khata</p>
            <p className="text-xs text-muted-foreground">{group?.name ?? "Loading…"}</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
            onClick={() => {
              setLight(!light);
              try {
                localStorage.setItem("khata-theme", !light ? "light" : "dark");
              } catch {
                /* Keep the toggle usable without storage. */
              }
            }}
          >
            {light ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menu"
              className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/members" className="flex items-center gap-2 py-2">
                  <Users className="h-4 w-4" /> Members & UPI
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 px-4 pb-32 pt-8 md:px-8 md:pt-10">
        {group && <DraftRecovery key={group.id} groupId={group.id} />}
        {group && <GroupTools />}
        {groupQuery.isError ? (
          <ErrorState error={groupQuery.error} onRetry={() => groupQuery.refetch()} />
        ) : (
          children
        )}
      </main>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-2xl rounded-3xl border border-border bg-card/95 p-1 shadow-2xl backdrop-blur-xl"
      >
        <ul className="grid grid-cols-6">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/" ? pathname === "/" || pathname === "/review" : pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span className={`rounded-full px-3 py-1 ${active ? "bg-secondary" : ""}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
