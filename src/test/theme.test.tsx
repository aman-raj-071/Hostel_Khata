import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/queries", () => ({
  useGroup: () => ({ data: { id: "theme-group", name: "Flat 302", members: [] }, isError: false }),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
  vi.restoreAllMocks();
});

describe("app theme", () => {
  it("defaults to dark and persists the light toggle", () => {
    render(
      <AppShell>
        <p>Expense screen</p>
      </AppShell>,
    );
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByLabelText("Switch to light mode"));
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("khata-theme")).toBe("light");
  });
  it("restores an existing light preference", async () => {
    localStorage.setItem("khata-theme", "light");
    render(<AppShell>Expense screen</AppShell>);
    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
  });
  it("keeps working when storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<AppShell>Expense screen</AppShell>);
    fireEvent.click(screen.getByLabelText("Switch to light mode"));
    expect(document.documentElement).toHaveClass("light");
  });
});
