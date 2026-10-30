import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSession, login, signup, tryDemo, logout, updateProfile } from "@/lib/api";
import { AccountContext, useAccount, clearPrivateDrafts } from "@/lib/account-context";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, ListSkeleton } from "@/components/States";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function AccountMenu() {
  const { session } = useAccount();
  if (!session?.user)
    return (
      <div className="flex gap-2">
        <Button variant="ghost" asChild>
          <Link to="/login">Login</Link>
        </Button>
        <Button asChild>
          <Link to="/signup">Sign up</Link>
        </Button>
      </div>
    );
  const user = session.user;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="h-11 min-w-11 rounded-full border border-border px-3 font-semibold"
        style={{ borderColor: user.color }}
      >
        {user.name.slice(0, 1).toUpperCase()}
        {user.demoExpiresAt ? " · Demo" : ""}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/groups">My groups</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await logout();
              clearPrivateDrafts();
              window.location.assign("/login");
            } catch (e) {
              window.alert(e instanceof Error ? e.message : "Could not log out. Please try again.");
            }
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-5xl">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <Link to="/" className="font-display text-xl font-bold">
          ₹ Hostel Khata
        </Link>
        <AccountMenu />
      </header>
      <main className="px-5 py-10">{children}</main>
    </div>
  );
}
export function AccountGate({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["account"],
    queryFn: getSession,
    retry: false,
    enabled: typeof window !== "undefined",
    refetchInterval: 30000,
  });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const session = query.data ?? null;
  const publicPath = pathname === "/" || pathname === "/login" || pathname === "/signup";
  useEffect(() => {
    if (query.isPending || query.isError) return;
    if (!session?.user && !publicPath) void navigate({ to: "/login", replace: true });
    else if (session?.user && (pathname === "/login" || pathname === "/signup"))
      void navigate({ to: session.activeGroupId ? "/" : "/groups", replace: true });
    else if (session?.user && !session.activeGroupId && !["/groups", "/profile"].includes(pathname))
      void navigate({ to: "/groups", replace: true });
  }, [query.isPending, query.isError, session, publicPath, pathname, navigate]);
  const value = { session, loading: query.isPending, error: query.error, refresh: query.refetch };
  if (query.isPending)
    return (
      <div className="mx-auto max-w-xl p-8">
        <ListSkeleton rows={3} />
      </div>
    );
  if (query.isError)
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  return (
    <AccountContext.Provider value={value}>
      {!session?.user ? (
        <PublicShell>
          {pathname === "/" ? <Landing /> : publicPath ? children : <p>Redirecting to Login…</p>}
        </PublicShell>
      ) : pathname === "/groups" || pathname === "/profile" ? (
        <PublicShell>{children}</PublicShell>
      ) : session.activeGroupId ? (
        <AppShell>{children}</AppShell>
      ) : (
        <PublicShell>
          <p>Opening your groups…</p>
        </PublicShell>
      )}
    </AccountContext.Provider>
  );
}
export function DemoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await tryDemo();
            clearPrivateDrafts();
            window.location.assign("/");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Demo unavailable");
            setBusy(false);
          }
        }}
      >
        {busy ? "Creating your private demo…" : "Try demo"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
function Landing() {
  return (
    <section className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-8 text-center">
      <p className="text-sm uppercase tracking-widest text-primary">Less hisaab. More hostel.</p>
      <h1 className="my-5 font-display text-4xl font-bold">Your flat. Your private khata.</h1>
      <p className="mb-7 text-muted-foreground">
        Dictate a Hinglish paragraph with Wispr Flow, check the split and keep shared expenses
        clear.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/signup">Create account</Link>
        </Button>
        <DemoButton />
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Demo data is isolated and expires after 24 hours. No signup needed to try it.
      </p>
    </section>
  );
}
export function AccountForm({ kind }: { kind: "login" | "signup" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="mx-auto max-w-md rounded-3xl border border-border bg-card p-7">
      <h1 className="font-display text-3xl font-bold">
        {kind === "signup" ? "Welcome to your khata" : "Welcome back"}
      </h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">
        Private groups. Clear splits. Less awkward hisaab.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (kind === "signup") await signup(name, email, password);
            else await login(email, password);
            clearPrivateDrafts();
            window.location.assign("/");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not sign in");
            setBusy(false);
          }
        }}
      >
        {kind === "signup" && (
          <label className="block text-sm">
            Name
            <Input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </label>
        )}
        <label className="block text-sm">
          Email
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </label>
        <label className="block text-sm">
          Password
          <Input
            type="password"
            autoComplete={kind === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          At least 8 characters, at most 72 UTF-8 bytes.
        </p>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : kind === "signup" ? "Sign up" : "Login"}
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <DemoButton />
        <Link to={kind === "signup" ? "/login" : "/signup"} className="text-sm text-primary">
          {kind === "signup" ? "Already registered? Login" : "New here? Sign up"}
        </Link>
      </div>
    </section>
  );
}
export function ProfilePage() {
  const { session, refresh } = useAccount();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [upiId, setUpiId] = useState(session?.user?.upiId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-6">
      <h1 className="font-display text-3xl font-bold">Your profile</h1>
      <p className="my-3 text-sm text-muted-foreground">{session?.user?.email}</p>
      {session?.user?.demoExpiresAt && (
        <p className="mb-4 text-sm text-warning">
          Temporary demo. Sample UPI IDs are not payment addresses.
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await updateProfile({ name, upiId });
            await refresh();
            setMessage("Profile saved.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Could not save profile");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>
        <label className="block text-sm">
          UPI ID
          <Input
            placeholder="name@bank"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            maxLength={100}
          />
        </label>
        <p role="status" className="text-sm">
          {message}
        </p>
        <Button disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
      </form>
    </section>
  );
}
