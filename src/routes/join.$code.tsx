import { createFileRoute } from "@tanstack/react-router";
import { JoinPage } from "@/components/PrivateGroups";
export const Route = createFileRoute("/join/$code")({ component: JoinRoute });
function JoinRoute() {
  const { code } = Route.useParams();
  return <JoinPage code={code} />;
}
