import { createFileRoute } from "@tanstack/react-router";
import { GroupMembersPage } from "@/components/PrivateGroups";
export const Route = createFileRoute("/members")({ component: GroupMembersPage });
