import { createFileRoute } from "@tanstack/react-router";
import { AccountForm } from "@/components/Accounts";
export const Route = createFileRoute("/signup")({ component: () => <AccountForm kind="signup" /> });
