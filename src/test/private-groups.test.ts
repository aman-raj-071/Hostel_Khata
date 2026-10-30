import { expect, it } from "vitest";
import { safeAccountNext } from "@/lib/account-context";
import { activeMembers } from "@/lib/active-members";
it("only preserves internal invite destinations after login", () => {
  expect(safeAccountNext("?next=%2Fjoin%2FABCDEFGH23")).toBe("/join/ABCDEFGH23");
  for (const path of ["//evil.com", "https://evil.com", "/history", "/join/ABC?x=1"])
    expect(safeAccountNext("?next=" + encodeURIComponent(path))).toBe("/");
});
it("keeps removed and pending members out of new expense choices", () => {
  expect(
    activeMembers([
      { id: "a", name: "A", status: "active" },
      { id: "b", name: "B", status: "removed" },
      { id: "c", name: "C", status: "pending" },
    ]).map((m) => m.id),
  ).toEqual(["a"]);
});
