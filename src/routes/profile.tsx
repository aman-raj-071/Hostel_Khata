import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/Accounts";
export const Route = createFileRoute("/profile")({ component: ProfilePage });
