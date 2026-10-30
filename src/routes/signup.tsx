import { createFileRoute } from "@tanstack/react-router";
import { AccountForm } from "@/components/Accounts";
export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined } => ({
    next: typeof s["next"] === "string" ? s["next"] : undefined,
  }),
  component: () => <AccountForm kind="signup" />,
});
