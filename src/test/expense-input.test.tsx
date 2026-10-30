import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/index";
import { setDraft } from "@/lib/draft";
const mocks = vi.hoisted(() => ({ parse: vi.fn(), save: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/queries", () => ({ useGroup: () => ({ data: { id: "g", members: [] } }) }));
vi.mock("@/lib/api", () => ({ parseText: mocks.parse, saveExpenses: mocks.save }));
vi.mock("@/components/RecurringTemplates", () => ({ RecurringTemplates: () => null }));
afterEach(() => {
  cleanup();
  setDraft([]);
  vi.clearAllMocks();
});
it.each([{ ctrlKey: true }, { metaKey: true }])(
  "parses with Ctrl/Cmd Enter without saving",
  async (keys) => {
    mocks.parse.mockResolvedValue({ expenses: [{ payer: "Kabir", amount: 100 }] });
    const Page = Route.options.component as () => React.ReactElement;
    render(<Page />);
    const input = screen.getByRole("textbox", { name: "Expense text" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "Kabir ne chai 100" } });
    fireEvent.keyDown(input, { key: "Enter", ...keys });
    await waitFor(() =>
      expect(mocks.parse).toHaveBeenCalledWith("Kabir ne chai 100", "brain-dump"),
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/review" });
    expect(mocks.save).not.toHaveBeenCalled();
  },
);
it("leaves ordinary Enter and Fn to normal input behavior", () => {
  const Page = Route.options.component as () => React.ReactElement;
  render(<Page />);
  const input = screen.getByRole("textbox", { name: "Expense text" });
  expect(fireEvent.keyDown(input, { key: "Fn" })).toBe(true);
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
  expect(mocks.parse).not.toHaveBeenCalled();
});
