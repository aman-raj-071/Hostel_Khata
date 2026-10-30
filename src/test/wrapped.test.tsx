import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WrappedPage } from "@/routes/wrapped";

const { query, toPng } = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: new Error("Offline"),
    refetch: vi.fn(),
  },
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,example"),
}));
vi.mock("@/lib/queries", () => ({
  useGroup: () => ({ data: { name: "Flat 302", members: [{ id: "a", name: "Aman" }] } }),
  useWrapped: () => query,
}));
vi.mock("html-to-image", () => ({ toPng }));
beforeEach(() => {
  query.data = {
    total: 120,
    awards: [
      {
        title: "Daanveer",
        memberId: "a",
        value: 120,
        emoji: "👑",
        line: "Aman ne sabse zyada pay kiya!",
      },
    ],
    biggestExpense: { payerId: "a", amount: 120, description: "Dinner", date: "2026-10-29" },
  };
  query.isLoading = query.isError = false;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("Wrapped stories", () => {
  it("supports progress taps, swipe, arrows and PNG export of the current card", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<WrappedPage />);
    expect(screen.getByRole("heading", { name: "Flat 302 Wrapped" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Story 2"));
    expect(screen.getByRole("heading", { name: "Daanveer" })).toBeInTheDocument();
    fireEvent.touchStart(screen.getByRole("region", { name: "Wrapped story" }), {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchEnd(screen.getByRole("region", { name: "Wrapped story" }), {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(screen.getByRole("heading", { name: "Biggest expense" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "Wrapped story" }), { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "Daanveer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share PNG" }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(toPng.mock.calls[0]![0]).toHaveTextContent("Daanveer");
  });
  it("shows empty, loading and recoverable error states", () => {
    query.data = { total: 0, awards: [], biggestExpense: null };
    const view = render(<WrappedPage />);
    expect(screen.getByText("Your story starts with a kharcha")).toBeInTheDocument();
    query.isLoading = true;
    view.rerender(<WrappedPage />);
    expect(screen.queryByText("Your story starts with a kharcha")).not.toBeInTheDocument();
    query.isLoading = false;
    query.isError = true;
    view.rerender(<WrappedPage />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(query.refetch).toHaveBeenCalled();
  });
});
