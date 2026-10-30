import type { Member } from "./types";
export const activeMembers = (members: Member[]) =>
  members.filter((m) => !m.status || m.status === "active");
