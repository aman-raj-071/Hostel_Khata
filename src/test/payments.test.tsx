import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { PaymentInbox } from "@/components/PaymentInbox";
import { buildUpiLink } from "@/lib/format";
const mocks = vi.hoisted(() => ({ who: "receiver", decide: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/account-context", () => ({
  useAccount: () => ({ session: { user: { id: mocks.who } } }),
}));
vi.mock("@/lib/queries", () => ({
  useGroup: () => ({
    data: {
      members: [
        { userId: "payer", name: "Aman" },
        { userId: "receiver", name: "Riya" },
      ],
    },
  }),
}));
vi.mock("@/lib/api", () => ({ listPayments: mocks.list, decidePayment: mocks.decide }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function inbox() {
  mocks.list.mockResolvedValue([
    {
      id: "p",
      groupId: "g",
      fromUserId: "payer",
      toUserId: "receiver",
      amount: 10.01,
      status: "pending",
      upiRef: "UTR123",
      note: "Sent",
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    },
  ]);
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PaymentInbox />
    </QueryClientProvider>,
  );
}
it("receiver confirms explicitly after reviewing receipt", async () => {
  mocks.who = "receiver";
  mocks.decide.mockResolvedValue({});
  inbox();
  fireEvent.click(await screen.findByRole("button", { name: "Confirm received" }));
  expect(mocks.decide).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm action" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith("p", "confirm"));
});
it("payer can cancel but has no receiver confirmation control", async () => {
  mocks.who = "payer";
  inbox();
  expect(await screen.findByRole("button", { name: "Cancel pending payment" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm received" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dispute" })).not.toBeInTheDocument();
});
it("encodes the receiver UPI, name, paise and note in the QR destination", () => {
  const url = new URL(buildUpiLink("riya@okaxis", "Riya & Co", 10.01));
  expect(url.protocol).toBe("upi:");
  expect(url.searchParams.get("pa")).toBe("riya@okaxis");
  expect(url.searchParams.get("pn")).toBe("Riya & Co");
  expect(url.searchParams.get("am")).toBe("10.01");
  expect(url.searchParams.get("cu")).toBe("INR");
  expect(url.searchParams.get("tn")).toBe("Hostel Khata");
});
