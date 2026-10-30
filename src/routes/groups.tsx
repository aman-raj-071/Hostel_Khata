import { createFileRoute } from "@tanstack/react-router";
import { GroupsPage } from "@/components/PrivateGroups";
export const Route = createFileRoute("/groups")({ component: GroupsPage });
