import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountGate, AccountForm, DemoButton } from "@/components/Accounts";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  demo: vi.fn(),
  navigate: vi.fn(),
  path: "/",
}));
vi.mock("@/lib/api", () => ({
  getSession: mocks.session,
  login: mocks.login,
  signup: mocks.signup,
  tryDemo: mocks.demo,
  logout: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: mocks.path }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.path = "/";
  localStorage.clear();
});
afterEach(() => cleanup());
function gate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountGate>
        <p>Private ledger</p>
      </AccountGate>
    </QueryClientProvider>,
  );
}
it("offers an anonymous landing demo without rendering private content", async () => {
  mocks.session.mockResolvedValue({ user: null, activeGroupId: null });
  gate();
  expect(await screen.findByRole("button", { name: "Try demo" })).toBeInTheDocument();
  expect(screen.queryByText("Private ledger")).not.toBeInTheDocument();
});
it("redirects unauthenticated private routes to login", async () => {
  mocks.path = "/history";
  mocks.session.mockResolvedValue({ user: null, activeGroupId: null });
  gate();
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login", replace: true }));
  expect(screen.queryByText("Private ledger")).not.toBeInTheDocument();
});
it("shows the app only after a real session and selected group", async () => {
  mocks.session.mockResolvedValue({
    user: {
      id: "u",
      name: "Kabir",
      email: "k@test.invalid",
      upiId: null,
      color: "#e9ad55",
      demoExpiresAt: null,
    },
    activeGroupId: "g",
  });
  gate();
  expect(await screen.findByText("Private ledger")).toBeInTheDocument();
});
it("shows generic login errors and never stores login tokens", async () => {
  mocks.login.mockRejectedValue(
    new Error("Unable to sign in. Check your details or try again later."),
  );
  render(<AccountForm kind="login" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-123" } });
  fireEvent.submit(screen.getByRole("button", { name: "Login" }).closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in");
  expect(mocks.login).toHaveBeenCalledWith("test@example.com", "password-123");
  expect(localStorage.length).toBe(0);
});
it("keeps demo creation loading/failure states usable", async () => {
  mocks.demo.mockRejectedValue(new Error("Demo limit reached. Please try later."));
  render(<DemoButton />);
  fireEvent.click(screen.getByRole("button", { name: "Try demo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Demo limit reached");
  expect(screen.getByRole("button", { name: "Try demo" })).toBeEnabled();
});
