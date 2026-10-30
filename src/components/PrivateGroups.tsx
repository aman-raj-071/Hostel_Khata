import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { PageTitle, ListSkeleton, ErrorState, Avatar } from "@/components/States";
import { useGroup } from "@/lib/queries";
import { useAccount, clearPrivateDrafts } from "@/lib/account-context";
import { getDraft } from "@/lib/draft";
import * as api from "@/lib/api";

function ConfirmAction({
  title,
  description,
  children,
  action,
  danger = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action: () => Promise<unknown>;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button
        variant={danger ? "destructive" : "outline"}
        size="sm"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {children}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={danger ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await action();
                  setOpen(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not complete action");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Please wait…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
async function openGroup(id: string) {
  await api.selectGroup(id);
  clearPrivateDrafts();
  window.location.assign("/");
}
function OpenGroup({ id }: { id: string }) {
  return (
    <ConfirmAction
      title="Open this group?"
      description={
        getDraft().length
          ? "Switching discards the unsaved review in this tab. Saved expenses stay in their group."
          : "Switch to this group's private ledger."
      }
      action={() => openGroup(id)}
    >
      Open group
    </ConfirmAction>
  );
}
export function GroupSwitcher() {
  const { session } = useAccount();
  const [switching, setSwitching] = useState(false);
  const q = useQuery({ queryKey: ["groups"], queryFn: api.listGroups });
  const current = q.data?.find((g) => g.id === session?.activeGroupId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="max-w-36 truncate rounded-xl border border-border px-3 py-2 text-xs"
        aria-label="Switch group"
        disabled={switching}
      >
        {switching ? "Switching…" : (current?.name ?? "Groups")} ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {q.isPending ? (
          <p className="p-3 text-xs">Loading groups…</p>
        ) : q.isError ? (
          <p className="p-3 text-xs">Groups unavailable.</p>
        ) : (
          q.data?.map((g) => (
            <DropdownMenuItem
              key={g.id}
              disabled={switching || g.status === "pending"}
              onSelect={() => {
                if (g.id === current?.id) return;
                if (getDraft().length) {
                  toast.error("Finish or discard the current review before switching groups.");
                  return;
                }
                setSwitching(true);
                void openGroup(g.id).catch((e) => {
                  setSwitching(false);
                  toast.error(e instanceof Error ? e.message : "Could not switch group");
                });
              }}
            >
              {g.name}
              {g.status === "pending" ? " · Pending" : g.id === current?.id ? " · Current" : ""}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem asChild>
          <Link to="/groups">Create or join a group</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function GroupsPage() {
  const q = useQuery({ queryKey: ["groups"], queryFn: api.listGroups });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { session } = useAccount();
  const demo = !!session?.user?.demoExpiresAt;
  async function join(value: string) {
    if (getDraft().length) {
      setError("Finish or discard the current review before joining another group.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.joinGroup(value);
      if (result.status === "active") await openGroup(result.groupId);
      else {
        setMessage("Request sent. An admin must approve you before you can open the group.");
        await q.refetch();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Your groups" subtitle="Only active members can open a private ledger." />
      {demo ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm">
          Your demo stays isolated. Sign up for a real account to create or join groups.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            className="space-y-3 rounded-3xl border border-border bg-card p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (getDraft().length) {
                  setError("Finish or discard the current review before creating another group.");
                  return;
                }
                const result = await api.createGroup(name);
                await openGroup(result.groupId);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not create group");
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="font-display text-xl font-bold">Create a group</h2>
            <label className="block text-sm">
              Group name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                placeholder="Flat 302"
              />
            </label>
            <Button disabled={busy || !name.trim()}>Create group</Button>
          </form>
          <form
            className="space-y-3 rounded-3xl border border-border bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void join(code);
            }}
          >
            <h2 className="font-display text-xl font-bold">Join with a code</h2>
            <label className="block text-sm">
              Invite code
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={32}
                minLength={8}
                required
                autoCapitalize="characters"
                placeholder="10-character invite code"
              />
            </label>
            <Button disabled={busy || !code.trim()}>Request to join</Button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-2xl border border-primary/30 p-4 text-sm">
          {message}
        </p>
      )}
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">
          No groups yet. Create one or enter your flatmate's invite code.
        </p>
      ) : (
        <div className="space-y-3">
          {q.data.map((g) => (
            <article
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
            >
              <div>
                <h2 className="font-semibold">{g.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {g.role} · {g.status === "pending" ? "Awaiting admin approval" : "Active member"}
                </p>
              </div>
              {g.status === "active" ? (
                <OpenGroup id={g.id} />
              ) : (
                <Button variant="outline" onClick={() => void q.refetch()}>
                  Check approval
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
export function JoinPage({ code }: { code: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-3xl border border-border bg-card p-6">
      <h1 className="font-display text-3xl font-bold">Join your flatmates</h1>
      <p className="text-sm text-muted-foreground">
        Code: {code}. An admin may need to approve your request.
      </p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            if (getDraft().length) {
              setError("Finish or discard your current review before joining another group.");
              return;
            }
            const result = await api.joinGroup(code);
            if (result.status === "active") await openGroup(result.groupId);
            else setMessage("Pending approval. Ask a group admin to approve you in Members.");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Invite unavailable");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending request…" : "Request to join"}
      </Button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-negative">
          {error}
        </p>
      )}
      <Button variant="outline" asChild>
        <Link to="/groups">My groups</Link>
      </Button>
    </section>
  );
}
export function GroupMembersPage() {
  const group = useGroup();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [expires, setExpires] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const g = group.data;
  const admin = g?.myRole === "admin";
  const members = useQuery({
    queryKey: ["group-members", g?.id],
    queryFn: () => api.listGroupMembers(g!.id),
    enabled: !!g,
  });
  const invites = useQuery({
    queryKey: ["invites", g?.id],
    queryFn: () => api.listInvites(g!.id),
    enabled: !!g && admin,
  });
  const refresh = () => qc.invalidateQueries();
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete action");
    } finally {
      setBusy(false);
    }
  };
  if (group.isError) return <ErrorState error={group.error} onRetry={() => void group.refetch()} />;
  if (group.isPending) return <ListSkeleton rows={4} />;
  if (members.isError)
    return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;
  if (members.isPending) return <ListSkeleton rows={4} />;
  if (!g) return null;
  const currentInvite = invites.data?.find(
    (i) =>
      !i.revoked &&
      new Date(i.expiresAt) > new Date() &&
      (i.maxUses === null || i.uses < i.maxUses),
  );
  return (
    <div className="space-y-6">
      <PageTitle
        title="Your flatmates"
        subtitle="Profiles belong to real accounts. Invites never grant access until membership is active."
      />
      <Button variant="outline" asChild>
        <Link to="/profile">Edit my name & UPI ID</Link>
      </Button>
      {admin && (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-bold">Invite & approval settings</h2>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={g.requireApproval ?? true}
              disabled={busy}
              onChange={(e) => void act(() => api.setGroupApproval(g.id, e.target.checked))}
            />
            Require admin approval for new members
          </label>
          {invites.isError ? (
            <ErrorState error={invites.error} onRetry={() => void invites.refetch()} />
          ) : invites.isPending ? (
            <p>Loading invite…</p>
          ) : currentInvite ? (
            <div className="space-y-2">
              <p className="font-mono text-xl font-bold text-primary">{currentInvite.code}</p>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(currentInvite.expiresAt).toLocaleString()} · {currentInvite.uses}/
                {currentInvite.maxUses ?? "unlimited"} uses
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        window.location.origin + "/join/" + currentInvite.code,
                      );
                      toast.success("Invite link copied");
                    } catch {
                      toast.error("Copy unavailable; share the code shown above.");
                    }
                  }}
                >
                  Copy invite link
                </Button>
                <ConfirmAction
                  title="Revoke this invite?"
                  description="The code will stop accepting new requests. Existing memberships stay unchanged."
                  action={async () => {
                    await api.revokeInvite(g.id, currentInvite.id);
                    await refresh();
                  }}
                >
                  Revoke invite
                </ConfirmAction>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No valid invite. Generate a fresh code.</p>
          )}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() =>
                api.regenerateInvite(g.id, {
                  ...(expires ? { expiresAt: new Date(expires).toISOString() } : {}),
                  maxUses: maxUses ? Number(maxUses) : null,
                }),
              );
            }}
          >
            <label className="text-sm">
              Expiry (optional)
              <Input
                type="datetime-local"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Max uses (optional)
              <Input
                type="number"
                min={1}
                max={1000}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </label>
            <Button disabled={busy}>Regenerate invite</Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Regenerating revokes older codes. Requests consume a use even while pending. Turning
            approval off does not approve existing requests.
          </p>
        </section>
      )}
      <div className="space-y-3">
        {members.data?.map((m) => (
          <article
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <Avatar name={m.name} />
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.role} · {m.status} · {m.upiId || "UPI not added"}
                </p>
              </div>
            </div>
            {admin && m.status === "pending" ? (
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void act(() => api.decideMember(g.id, m.id, "approve"))}
                >
                  Approve {m.name}
                </Button>
                <ConfirmAction
                  title={"Reject " + m.name + "?"}
                  description="They will not gain access to this group."
                  action={async () => {
                    await api.decideMember(g.id, m.id, "reject");
                    await refresh();
                  }}
                >
                  Reject
                </ConfirmAction>
              </div>
            ) : admin && m.status === "active" && m.id !== g.myMemberId ? (
              <div className="flex flex-wrap gap-2">
                <ConfirmAction
                  title={"Transfer admin to " + m.name + "?"}
                  description="You become a regular member and they can manage the group."
                  action={async () => {
                    await api.transferAdmin(g.id, m.id);
                    await refresh();
                  }}
                >
                  Make admin
                </ConfirmAction>
                <ConfirmAction
                  title={"Remove " + m.name + "?"}
                  description="Access stops immediately. Their past expenses remain in history."
                  danger
                  action={async () => {
                    await api.removeGroupMember(g.id, m.id);
                    await refresh();
                  }}
                >
                  Remove
                </ConfirmAction>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <ConfirmAction
          title="Leave this group?"
          description="Your balance must be settled. A last admin must transfer admin or delete the group."
          action={async () => {
            await api.leaveGroup(g.id);
            clearPrivateDrafts();
            window.location.assign("/groups");
          }}
        >
          Leave group
        </ConfirmAction>
        {admin && (
          <ConfirmAction
            title="Delete this group and all its expenses?"
            description="This permanently removes the ledger for everyone. This cannot be undone."
            danger
            action={async () => {
              await api.deleteGroup(g.id);
              clearPrivateDrafts();
              window.location.assign("/groups");
            }}
          >
            Delete group
          </ConfirmAction>
        )}
      </div>
    </div>
  );
}
