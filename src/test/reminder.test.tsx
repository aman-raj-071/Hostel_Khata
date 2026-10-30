import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderSheet } from "@/components/ReminderSheet";
import { generateReminder } from "@/lib/api";
import { toast } from "sonner";

vi.mock("@/lib/api", () => ({ generateReminder: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const generate = vi.mocked(generateReminder);
const props = {
  from: { id: "a", name: "Aman" },
  to: { id: "r", name: "Riya" },
  amount: 340.51,
  onClose: vi.fn(),
};
beforeEach(() => {
  generate.mockResolvedValue({ message: "Aman, Riya ko ₹340.51 bhej do. UPI available hai." });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("reminder sheet", () => {
  it("loads polite, changes tone, and shares the edited message rather than the generated original", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: copy } });
    render(<ReminderSheet {...props} />);
    expect(screen.getByRole("status", { name: "Generating reminder" })).toBeInTheDocument();
    const field = await screen.findByLabelText("Reminder message");
    expect(generate).toHaveBeenCalledWith({
      fromId: "a",
      toId: "r",
      amount: 340.51,
      tone: "polite",
    });
    fireEvent.click(screen.getByRole("button", { name: "filmy" }));
    await waitFor(() =>
      expect(generate).toHaveBeenLastCalledWith({
        fromId: "a",
        toId: "r",
        amount: 340.51,
        tone: "filmy",
      }),
    );
    const edited = await screen.findByLabelText("Reminder message");
    fireEvent.change(edited, { target: { value: "Aman & Riya: ₹340.51? UPI ✅" } });
    expect(
      new URL(
        screen.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href")!,
      ).searchParams.get("text"),
    ).toBe("Aman & Riya: ₹340.51? UPI ✅");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("Aman & Riya: ₹340.51? UPI ✅"));
    fireEvent.change(edited, { target: { value: " " } });
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
    expect(screen.getByText("Send on WhatsApp").closest("a")).not.toHaveAttribute("href");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalled();
    expect(field).not.toBeNull();
  });
  it("shows failure and supports an explicit retry", async () => {
    generate.mockRejectedValueOnce(new Error("Too many reminder requests. Please wait a minute."));
    render(<ReminderSheet {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("wait a minute");
    expect(screen.queryByRole("link", { name: "Send on WhatsApp" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByLabelText("Reminder message");
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("handles clipboard denial without discarding the message", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<ReminderSheet {...props} />);
    await screen.findByLabelText("Reminder message");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("copy it manually")),
    );
    expect(screen.getByLabelText("Reminder message")).toHaveValue(
      "Aman, Riya ko ₹340.51 bhej do. UPI available hai.",
    );
  });
  it("ignores a previous request after closing and reopening for another payment", async () => {
    let resolve!: (value: { message: string }) => void;
    generate.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = render(<ReminderSheet {...props} />);
    first.unmount();
    render(<ReminderSheet {...props} amount={500} />);
    await screen.findByLabelText("Reminder message");
    await act(async () => resolve({ message: "Old reminder" }));
    expect(screen.getByLabelText("Reminder message")).not.toHaveValue("Old reminder");
  });
});
